import { readFile } from 'node:fs/promises'
import type { BenchmarkReport, BenchmarkReportResponse } from '../../../shared/types/api'

/** The latest `bun run bench` result, if there is one. */
export default defineEventHandler(async (): Promise<BenchmarkReportResponse> => {
  try {
    return { report: JSON.parse(await readFile('.data/benchmark-report.json', 'utf8')) as BenchmarkReport }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { report: null }
    throw error
  }
})
