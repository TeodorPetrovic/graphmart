import { GRAPH_TIMEOUT_MS } from '../graph/limits'
import type { RouteMetric } from '../../../shared/types/api'
import { int, readCypher } from '../../infrastructure/neo4j/client'
import type { Tracer } from '../../infrastructure/trace'
import { buildGraph, type GraphEdgeInput, type GraphNodeInput } from '../graph/dto'

interface WarehouseRow {
  id: number
  name: string
  city: string
  lat: number
  lng: number
}

interface RouteRow {
  stops: { id: number; name: string; city: string }[]
  distanceKm: number
  durationMin: number
  hops: number
  graphNodes: GraphNodeInput[]
  graphEdges: GraphEdgeInput[]
}

const NETWORK_QUERY = `
// A single optional expansion returns the directed warehouse transport graph.
MATCH (warehouse:Warehouse)
OPTIONAL MATCH (warehouse)-[route:ROUTE_TO]->(destination:Warehouse)
RETURN collect(DISTINCT {
         id:warehouse.id, name:warehouse.name, city:warehouse.city,
         lat:warehouse.lat, lng:warehouse.lng
       }) AS warehouses,
       collect(DISTINCT {
         kind: 'Warehouse', key: warehouse.id, label: warehouse.city,
         props:{city:warehouse.city, x:warehouse.lng * 40, y:-warehouse.lat * 55,
                lat:warehouse.lat, lng:warehouse.lng}
       }) AS nodes,
       collect(DISTINCT CASE WHEN destination IS NULL THEN null ELSE {
         type:'ROUTE_TO', sourceKind:'Warehouse', sourceKey:warehouse.id,
         targetKind:'Warehouse', targetKey:destination.id,
         props:{distanceKm:route.distanceKm, durationMin:route.durationMin}
       } END) AS edges
`

/** Warehouse coordinates become graph props so the UI can lay out a useful map without GIS. */
export async function network(tracer?: Tracer) {
  const [row] = await readCypher<{
    warehouses: WarehouseRow[]
    nodes: GraphNodeInput[]
    edges: (GraphEdgeInput | null)[]
  }>(NETWORK_QUERY, {}, { tracer, operation: 'Warehouse network' })

  return {
    warehouses: row?.warehouses ?? [],
    graph: buildGraph(
      row?.nodes ?? [],
      (row?.edges ?? []).filter((edge): edge is GraphEdgeInput => edge !== null),
    ),
    trace: tracer?.entries ?? [],
  }
}

const ROUTE_QUERY = `
// Simple directed paths are bounded to six hops; each metric is calculated from its own relationship property.
MATCH (origin:Warehouse {id:$from}), (destination:Warehouse {id:$to})
MATCH path=(origin)-[:ROUTE_TO*1..6]->(destination)
WHERE all(node IN nodes(path) WHERE single(candidate IN nodes(path) WHERE candidate = node))
WITH path,
     reduce(total=0.0, route IN relationships(path) | total + route.distanceKm) AS distanceKm,
     reduce(total=0.0, route IN relationships(path) | total + route.durationMin) AS durationMin,
     length(path) AS hops
ORDER BY CASE $metric
           WHEN 'distance' THEN distanceKm
           WHEN 'duration' THEN durationMin
           ELSE toFloat(hops)
         END,
         distanceKm, durationMin, hops, [node IN nodes(path) | node.id]
LIMIT 4
RETURN [node IN nodes(path) | {id:node.id,name:node.name,city:node.city}] AS stops,
       distanceKm, durationMin, hops,
       [node IN nodes(path) | {kind:'Warehouse',key:node.id,label:node.city,props:{city:node.city}}] AS graphNodes,
       [route IN relationships(path) | {
         type:'ROUTE_TO', sourceKind:'Warehouse', sourceKey:startNode(route).id,
         targetKind:'Warehouse', targetKey:endNode(route).id,
         props:{distanceKm:route.distanceKm,durationMin:route.durationMin}
       }] AS graphEdges
`

/** Returns the four best simple routes with stable tie-breaking for the selected metric. */
export async function route(from: number, to: number, metric: RouteMetric, tracer?: Tracer) {
  const rows = await readCypher<RouteRow>(
    ROUTE_QUERY,
    {
      from: int(from),
      to: int(to),
      metric,
    },
    { tracer, operation: `Warehouse route (${metric})`, timeoutMs: GRAPH_TIMEOUT_MS },
  )
  const results = rows.map(({ stops, distanceKm, durationMin, hops }) => ({ stops, distanceKm, durationMin, hops }))

  return {
    metric,
    best: results[0] ?? null,
    alternatives: results.slice(1),
    graph: buildGraph(
      rows.flatMap((row) => row.graphNodes),
      rows.flatMap((row) => row.graphEdges),
    ),
    trace: tracer?.entries ?? [],
  }
}

const FULFILLMENT_QUERY = `
// A per-source bounded shortest-path search returns one best route for each stocked warehouse.
MATCH (destination:Warehouse {id:$destination})
MATCH (source:Warehouse)-[stock:STOCKS]->(:Product {id:$productId})
WHERE source <> destination
CALL (source, destination) {
  MATCH path=(source)-[:ROUTE_TO*1..6]->(destination)
  WHERE all(node IN nodes(path) WHERE single(candidate IN nodes(path) WHERE candidate = node))
  WITH path,
       reduce(total=0.0, route IN relationships(path) | total + route.distanceKm) AS distanceKm,
       reduce(total=0.0, route IN relationships(path) | total + route.durationMin) AS durationMin
  ORDER BY distanceKm, durationMin, length(path), [node IN nodes(path) | node.id]
  LIMIT 1
  RETURN path, distanceKm, durationMin
}
RETURN source.id AS warehouseId, source.name AS name, stock.quantity AS quantity,
       [node IN nodes(path) | {id:node.id,name:node.name,city:node.city}] AS stops,
       distanceKm, durationMin, length(path) AS hops
ORDER BY distanceKm, durationMin, hops, warehouseId
`

/** Stock candidates are ranked by their own best distance route to the destination hub. */
export async function fulfillment(productId: number, destination: number, tracer?: Tracer) {
  const rows = await readCypher<{
    warehouseId: number
    name: string
    quantity: number
    stops: { id: number; name: string; city: string }[]
    distanceKm: number
    durationMin: number
    hops: number
  }>(
    FULFILLMENT_QUERY,
    {
      productId: int(productId),
      destination: int(destination),
    },
    { tracer, operation: 'Product fulfillment options', timeoutMs: GRAPH_TIMEOUT_MS },
  )

  return {
    destinationWarehouseId: destination,
    options: rows.map(({ warehouseId, name, quantity, ...route }) => ({ warehouseId, name, quantity, route })),
    trace: tracer?.entries ?? [],
  }
}
