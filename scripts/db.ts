/**
 * Runs project-local MongoDB, MySQL and Neo4j instances without Docker.
 * Data lives in `.data/`, ports differ from the defaults, and nothing touches
 * database servers that are already installed as system services.
 *
 *   bun run db:setup   initialise data directories (once)
 *   bun run db:up      start all three and wait until they accept connections
 *   bun run db:down    stop them
 *   bun run db:status
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { MongoClient } from 'mongodb'
import mysql from 'mysql2/promise'
import neo4j from 'neo4j-driver'
import { config } from '../server/infrastructure/config'

const root = resolve(import.meta.dir, '..')
const data = join(root, '.data')
const tools = join(root, '.tools')
const windows = process.platform === 'win32'
const exe = windows ? '.exe' : ''
const mongoPort = Number(new URL(config.MONGO_URI).port || 27027)
const neo4jBoltPort = Number(new URL(config.NEO4J_URI).port || 7697)
const NEO4J_HTTP_PORT = 7484

// ---------- binary discovery ----------

function subdirectories(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .reverse()
    .map((name) => join(dir, name))
}

function onPath(name: string): string | undefined {
  return Bun.which(name) ?? undefined
}

function required(label: string, candidates: (string | undefined)[], hint: string): string {
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error(`${label} not found. ${hint}`)
  return found
}

const mongodBin = () =>
  required(
    'mongod',
    [
      process.env.MONGOD_BIN,
      ...subdirectories('C:/Program Files/MongoDB/Server').map((dir) => join(dir, 'bin', 'mongod.exe')),
      onPath('mongod'),
    ],
    'Install MongoDB Community Server or set MONGOD_BIN.',
  )

const mysqldBin = () =>
  required(
    'mysqld',
    [
      process.env.MYSQLD_BIN,
      ...subdirectories('C:/Program Files/MySQL', 'MySQL Server').map((dir) => join(dir, 'bin', 'mysqld.exe')),
      onPath('mysqld'),
    ],
    'Install MySQL Server 8 or set MYSQLD_BIN.',
  )

const neo4jHome = () =>
  required(
    'Neo4j',
    [process.env.NEO4J_HOME, ...subdirectories(tools, 'neo4j-community-')],
    'Download Neo4j Community (zip) from https://neo4j.com/deployment-center/ and unpack it into .tools/, or set NEO4J_HOME.',
  )

/** Neo4j 2025+ needs Java 21+. Neo4j Desktop ships a suitable runtime. */
function javaHome(): string {
  const desktop = subdirectories(join(homedir(), '.Neo4jDesktop2', 'Cache', 'runtime')).filter((dir) =>
    /zulu(21|25)\./.test(dir),
  )
  const candidates = [process.env.NEO4J_JAVA_HOME, ...desktop, ...subdirectories(tools, 'jdk-'), process.env.JAVA_HOME]
  const found = candidates.find((dir) => dir && existsSync(join(dir, 'bin', `java${exe}`)) && javaMajor(dir) >= 21)
  if (!found) throw new Error('Java 21+ not found. Install a JDK 21 or set NEO4J_JAVA_HOME.')
  return found
}

function javaMajor(home: string): number {
  const out = spawnSync(join(home, 'bin', `java${exe}`), ['-version'], { encoding: 'utf8' }).stderr ?? ''
  const match = /version "(\d+)/.exec(out)
  return match ? Number(match[1]) : 0
}

// ---------- process helpers ----------

function background(name: string, command: string, args: string[], env: Record<string, string> = {}): void {
  const log = openSync(join(data, `${name}.log`), 'a')
  const child = spawn(command, args, {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, ...env },
    windowsHide: true,
    shell: command.endsWith('.bat'),
  })
  child.unref()
  writeFileSync(join(data, `${name}.pid`), String(child.pid))
}

function killTree(name: string): void {
  const pidFile = join(data, `${name}.pid`)
  if (!existsSync(pidFile)) return
  const pid = Number(readFileSync(pidFile, 'utf8'))
  if (windows) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'])
  else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      // already stopped
    }
  }
  rmSync(pidFile, { force: true })
}

async function waitFor(label: string, probe: () => Promise<void>, seconds = 120): Promise<void> {
  const deadline = Date.now() + seconds * 1000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await probe()
      return
    } catch (error) {
      lastError = error
      await Bun.sleep(1000)
    }
  }
  throw new Error(`${label} did not become ready: ${String(lastError)}. See .data/*.log`)
}

// ---------- probes ----------

async function withMongo<T>(work: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(config.MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  try {
    return await work(client)
  } finally {
    await client.close()
  }
}

const pingMongo = () => withMongo(async (client) => void (await client.db('admin').command({ ping: 1 })))

async function mysqlConnect(user: string, password: string) {
  return mysql.createConnection({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    user,
    password,
    connectTimeout: 1500,
  })
}

async function pingMysql(): Promise<void> {
  const connection = await mysqlConnect(config.MYSQL_USER, config.MYSQL_PASSWORD)
  await connection.end()
}

async function pingNeo4j(): Promise<void> {
  const driver = neo4j.driver(config.NEO4J_URI, neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD), {
    connectionTimeout: 1500,
  })
  try {
    await driver.verifyConnectivity()
  } finally {
    await driver.close()
  }
}

const isUp = (probe: () => Promise<void>) =>
  probe().then(
    () => true,
    () => false,
  )

// ---------- MongoDB ----------

async function startMongo(): Promise<void> {
  if (!(await isUp(pingMongo))) {
    const dbPath = join(data, 'mongo')
    mkdirSync(dbPath, { recursive: true })
    // A single node replica set is required for multi document transactions and change streams.
    background('mongo', mongodBin(), [
      '--dbpath',
      dbPath,
      '--port',
      String(mongoPort),
      '--bind_ip',
      '127.0.0.1',
      '--replSet',
      'rs0',
      '--wiredTigerCacheSizeGB',
      '1',
    ])
    await waitFor('MongoDB', pingMongo)
  }
  await withMongo(async (client) => {
    const admin = client.db('admin')
    try {
      await admin.command({ replSetGetStatus: 1 })
    } catch {
      await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }] } })
    }
    await waitFor('MongoDB primary', async () => {
      const hello = await admin.command({ hello: 1 })
      if (!hello.isWritablePrimary) throw new Error('not primary yet')
    })
  })
}

// ---------- MySQL ----------

const mysqlArgs = () => [
  '--no-defaults',
  `--datadir=${join(data, 'mysql')}`,
  `--port=${config.MYSQL_PORT}`,
  '--bind-address=127.0.0.1',
  '--mysqlx=OFF',
  '--innodb-buffer-pool-size=1G',
  '--innodb-redo-log-capacity=1G',
  '--skip-log-bin',
]

function initMysql(): void {
  const datadir = join(data, 'mysql')
  if (existsSync(join(datadir, 'mysql.ibd'))) return
  console.log('Initialising MySQL data directory...')
  mkdirSync(datadir, { recursive: true })
  const result = spawnSync(mysqldBin(), [...mysqlArgs(), '--initialize-insecure', '--console'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`mysqld --initialize failed:\n${result.stderr}`)
}

async function startMysql(): Promise<void> {
  if (await isUp(pingMysql)) return
  initMysql()
  background('mysql', mysqldBin(), [...mysqlArgs(), '--console'])
  // First start only: the freshly initialised root account has no password yet.
  await waitFor('MySQL', async () => {
    if (await isUp(pingMysql)) return
    const rootConnection = await mysqlConnect('root', '')
    const { MYSQL_USER: user, MYSQL_PASSWORD: password, MYSQL_DATABASE: database } = config
    await rootConnection.query('CREATE DATABASE IF NOT EXISTS ??', [database])
    await rootConnection.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [user, '%', password])
    await rootConnection.query('GRANT ALL PRIVILEGES ON *.* TO ?@?', [user, '%'])
    await rootConnection.query('ALTER USER ?@? IDENTIFIED BY ?', ['root', 'localhost', password])
    await rootConnection.end()
    await pingMysql()
  })
}

async function stopMysql(): Promise<void> {
  try {
    const connection = await mysqlConnect(config.MYSQL_USER, config.MYSQL_PASSWORD)
    await connection.query('SHUTDOWN')
    await connection.end()
    rmSync(join(data, 'mysql.pid'), { force: true })
  } catch {
    killTree('mysql')
  }
}

// ---------- Neo4j ----------

/** A private conf directory keeps the unpacked distribution untouched. */
function writeNeo4jConf(): string {
  const base = join(data, 'neo4j')
  const conf = join(base, 'conf')
  mkdirSync(conf, { recursive: true })
  const path = (name: string) => join(base, name).replaceAll('\\', '/')
  writeFileSync(
    join(conf, 'neo4j.conf'),
    [
      `server.directories.data=${path('data')}`,
      `server.directories.logs=${path('logs')}`,
      `server.directories.run=${path('run')}`,
      `server.directories.transaction.logs.root=${path('data/transactions')}`,
      'server.default_listen_address=127.0.0.1',
      `server.bolt.listen_address=127.0.0.1:${neo4jBoltPort}`,
      `server.bolt.advertised_address=127.0.0.1:${neo4jBoltPort}`,
      `server.http.listen_address=127.0.0.1:${NEO4J_HTTP_PORT}`,
      `server.http.advertised_address=127.0.0.1:${NEO4J_HTTP_PORT}`,
      'server.https.enabled=false',
      'server.memory.heap.initial_size=1G',
      'server.memory.heap.max_size=2G',
      'server.memory.pagecache.size=1G',
      'dbms.usage_report.enabled=false',
      'server.jvm.additional=--add-opens=java.base/java.nio=ALL-UNNAMED',
      'server.jvm.additional=--add-opens=java.base/java.lang=ALL-UNNAMED',
      'server.jvm.additional=--enable-native-access=ALL-UNNAMED',
      '',
    ].join('\n'),
  )
  return conf
}

function neo4jEnv() {
  return { JAVA_HOME: javaHome(), NEO4J_CONF: writeNeo4jConf(), NEO4J_HOME: neo4jHome() }
}

async function startNeo4j(): Promise<void> {
  if (await isUp(pingNeo4j)) return
  const env = neo4jEnv()
  const bin = join(neo4jHome(), 'bin')
  const authFile = join(data, 'neo4j', 'data', 'dbms', 'auth.ini')
  if (!existsSync(authFile)) {
    const admin = join(bin, windows ? 'neo4j-admin.bat' : 'neo4j-admin')
    const result = spawnSync(admin, ['dbms', 'set-initial-password', config.NEO4J_PASSWORD], {
      env: { ...process.env, ...env },
      shell: windows,
      encoding: 'utf8',
    })
    if (result.status !== 0) throw new Error(`Could not set the Neo4j password:\n${result.stdout}\n${result.stderr}`)
  }
  background('neo4j', join(bin, windows ? 'neo4j.bat' : 'neo4j'), ['console'], env)
  await waitFor('Neo4j', pingNeo4j, 180)
}

// ---------- commands ----------

const command = process.argv[2] ?? 'status'
mkdirSync(data, { recursive: true })

async function status(): Promise<void> {
  const rows = await Promise.all(
    (
      [
        ['MongoDB', mongoPort, pingMongo],
        ['MySQL', config.MYSQL_PORT, pingMysql],
        ['Neo4j', neo4jBoltPort, pingNeo4j],
      ] as const
    ).map(async ([name, port, probe]) => `${name.padEnd(8)} port ${port}  ${(await isUp(probe)) ? 'up' : 'down'}`),
  )
  console.log(rows.join('\n'))
}

if (command === 'setup') {
  mongodBin()
  neo4jHome()
  javaHome()
  initMysql()
  console.log('Setup complete. Next: bun run db:up')
} else if (command === 'up') {
  await startMongo()
  console.log('MongoDB ready')
  await startMysql()
  console.log('MySQL ready')
  await startNeo4j()
  console.log(`Neo4j ready (browser: http://127.0.0.1:${NEO4J_HTTP_PORT})`)
} else if (command === 'down') {
  await withMongo((client) => client.db('admin').command({ shutdown: 1, force: true })).catch(() => undefined)
  rmSync(join(data, 'mongo.pid'), { force: true })
  await stopMysql()
  killTree('neo4j')
  console.log('Databases stopped')
} else if (command === 'status') {
  await status()
} else {
  console.error('Usage: bun scripts/db.ts setup|up|down|status')
  process.exit(1)
}
process.exit(0)
