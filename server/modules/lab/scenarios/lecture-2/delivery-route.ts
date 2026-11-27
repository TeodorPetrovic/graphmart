import { DEMO } from '../../../../../shared/utils/demo'
import { mysqlEngine } from '../../engines/mysql'
import { neo4jEngine } from '../../engines/neo4j'
import type { Scenario } from '../../types'

// The recursive route frontier carries visited ids so cycles cannot extend a walk.
const SQL = `
WITH RECURSIVE route_walk (warehouse_id, hops, distance, visited, route) AS (
  SELECT ?, 0, 0, CAST(CONCAT(',', ?, ',') AS CHAR(500)), CAST(? AS CHAR(500))
  UNION ALL
  SELECT edge.to_id, path.hops + 1, path.distance + edge.distance_km,
         CONCAT(path.visited, edge.to_id, ','), CONCAT(path.route, ',', edge.to_id)
  FROM route_walk path
  JOIN routes edge ON edge.from_id = path.warehouse_id
  WHERE path.hops < ?
    AND LOCATE(CONCAT(',', edge.to_id, ','), path.visited) = 0
)
SELECT distance, hops, route
FROM route_walk
WHERE warehouse_id = ?
ORDER BY distance, hops, route
LIMIT 1`

const CYPHER = (maxHops: number) => `
MATCH (source:Warehouse {id: $fromId})
MATCH (target:Warehouse {id: $toId})
MATCH path = (source)-[:ROUTE_TO*1..${maxHops}]->(target)
WITH path,
     reduce(distance = 0, leg IN relationships(path) | distance + leg.distanceKm) AS distance,
     reduce(route = toString(source.id), stop IN tail(nodes(path)) | route + ',' + toString(stop.id)) AS route
RETURN distance, length(path) AS hops, route
ORDER BY distance, hops, route
LIMIT 1`

export const deliveryRoute: Scenario = {
  id: 'delivery-route',
  lecture: 2,
  order: 16,
  title: 'Delivery route',
  question: 'What is the minimum-distance route, its hop count and warehouse id sequence?',
  relationalPain: 'SQL expands bounded route walks and carries visited ids to prevent cycles.',
  nosqlWin: 'Cypher sums each path’s relationship distances with reduce and returns the route in traversal order.',
  talkingPoints: [
    'Minimum total distance is the primary ranking, then fewer hops.',
    'The route graph is small, so the lesson is expressing path state and aggregation clearly.',
  ],
  params: [
    { name: 'fromId', label: 'From warehouse', type: 'number', default: DEMO.warehouseFromId, min: 1 },
    { name: 'toId', label: 'To warehouse', type: 'number', default: DEMO.warehouseToId, min: 1 },
    { name: 'maxHops', label: 'Maximum hops', type: 'number', default: 8, min: 1, max: 8 },
  ],
  engines: [
    mysqlEngine({
      label: 'Cycle-safe recursive routes',
      notes: ['The routes primary key expands only outgoing edges from each current warehouse.'],
      sql: SQL,
      values: (p) => [
        p.fromId as number,
        p.fromId as number,
        p.fromId as number,
        p.maxHops as number,
        p.toId as number,
      ],
    }),
    neo4jEngine({
      label: 'Bounded path + reduce',
      notes: [
        'Warehouse id constraints anchor the path endpoints.',
        'reduce sums edge weights and constructs the ordered id string.',
      ],
      cypher: (p) => CYPHER(p.maxHops as number),
    }),
  ],
}
