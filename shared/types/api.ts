/**
 * HTTP contract between server/api and app/. Dates are ISO strings on the wire.
 * Every endpoint that touches a database returns `trace`, so the UI can show
 * exactly which queries ran and how long they took.
 */
import type { Address, AttributeValue, OrderStatus, PaymentMethod, Tier } from './domain'

export type EngineId = 'mysql' | 'mongo' | 'neo4j'

export interface QueryTrace {
  engine: EngineId
  operation: string
  /** Human readable query text (Cypher, shell syntax, SQL) including parameters. */
  query: string
  ms: number
}

export type Traced<T> = T & { trace: QueryTrace[] }

export interface GraphNode {
  /** Unique within the graph: `<Kind>:<key>`, e.g. "User:1". */
  id: string
  label: string
  /** Neo4j label: User, Product, Category, Brand, Device, Card, Address, Warehouse. */
  kind: string
  highlight?: boolean
  props?: Record<string, unknown>
}
export interface GraphEdge {
  id: string
  source: string
  target: string
  /** Neo4j relationship type, e.g. FOLLOWS. */
  type: string
  highlight?: boolean
  props?: Record<string, unknown>
}
export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ---------- GET /api/system/health , GET /api/system/stats ----------
export interface EngineHealth {
  ok: boolean
  version: string | null
  latencyMs: number | null
  error: string | null
}
export type HealthResponse = Record<EngineId, EngineHealth>
/** Record keys are table / collection / label / relationship type names. null = engine unavailable. */
export interface StatsResponse {
  mysql: Record<string, number> | null
  mongo: Record<string, number> | null
  neo4jNodes: Record<string, number> | null
  neo4jRelationships: Record<string, number> | null
}

// ---------- GET /api/users?q=&limit= , GET /api/users/:id , GET /api/users/:id/orders ----------
export interface UserSummary {
  id: number
  name: string
  email: string
  city: string
  tier: Tier
}
export type UserListResponse = Traced<{ items: UserSummary[] }>
export type UserProfileResponse = Traced<{
  user: UserSummary & {
    country: string
    createdAt: string
    interests: string[]
    addresses: Address[]
    referredById: number | null
  }
  social: { followers: number; following: number }
}>
export interface OrderView {
  id: number
  userId: number
  status: OrderStatus
  createdAt: string
  totalCents: number
  items: { productId: number; name: string; unitPriceCents: number; quantity: number }[]
}
export type UserOrdersResponse = Traced<{ orders: OrderView[] }>

// ---------- GET /api/catalog/categories ----------
export interface CategoryNode {
  id: number
  name: string
  /** Products in this category and all its descendants. */
  productCount: number
  children: CategoryNode[]
}
export type CategoryTreeResponse = Traced<{ tree: CategoryNode[] }>

// ---------- GET /api/catalog/products ----------
// Query: q, categoryId, brand, minPrice, maxPrice (cents), attr (repeatable "key:value"),
//        sort = relevance|price_asc|price_desc|rating|newest, page (1-based), pageSize (max 48)
export interface ProductSummary {
  id: number
  name: string
  brand: string
  categoryId: number
  priceCents: number
  stock: number
  rating: number
  ratingCount: number
}
export interface FacetValue {
  value: string
  count: number
}
export type ProductSearchResponse = Traced<{
  items: ProductSummary[]
  total: number
  page: number
  pageSize: number
  facets: {
    brands: FacetValue[]
    priceBuckets: { min: number; max: number | null; count: number }[]
    attributes: { key: string; values: FacetValue[] }[]
  }
}>

// ---------- GET /api/catalog/products/:id?userId= (userId records a view) ----------
export interface ReviewView {
  id: number
  userId: number
  userName: string
  rating: number
  title: string
  body: string
  helpfulVotes: number
  createdAt: string
}
export interface RecommendedProduct {
  product: ProductSummary
  score: number
  reasons: string[]
}
export type ProductDetailResponse = Traced<{
  product: ProductSummary & {
    sku: string
    description: string
    attributes: Record<string, AttributeValue>
    tags: string[]
    breadcrumbs: { id: number; name: string }[]
  }
  reviews: ReviewView[]
  /** From Neo4j (ids + score), hydrated from MongoDB. Empty if Neo4j is unavailable. */
  alsoBought: RecommendedProduct[]
}>
// POST /api/catalog/products/:id/reviews
export interface CreateReviewRequest {
  userId: number
  rating: number
  title: string
  body: string
}
export type CreateReviewResponse = Traced<{ review: ReviewView; eventId: string }>

// ---------- POST /api/orders ----------
export interface CreateOrderRequest {
  userId: number
  items: { productId: number; quantity: number }[]
  paymentMethod: PaymentMethod
  cardFingerprint?: string | null
  deviceId: string
}
export type CreateOrderResponse = Traced<{ order: OrderView; eventId: string }>

// ---------- GET /api/sync/status , POST /api/sync/reconcile , POST /api/sync/rebuild ----------
export interface SyncEventView {
  id: string
  type: string
  createdAt: string
  processedAt: string | null
  lagMs: number | null
  attempts: number
  error: string | null
}
export type SyncStatusResponse = Traced<{
  projector: { running: boolean; startedAt: string | null; lastEventAt: string | null; lastError: string | null }
  counts: { pending: number; processed: number; failed: number }
  recent: SyncEventView[]
}>
export interface DriftCheck {
  name: string
  mongoCount: number
  neo4jCount: number
  inSync: boolean
}
export type ReconcileResponse = Traced<{ checks: DriftCheck[] }>
export type RebuildResponse = Traced<{ rebuilt: Record<string, number>; ms: number }>

// ---------- GET /api/analytics/dashboard ----------
export type AnalyticsResponse = Traced<{
  revenueByMonth: { month: string; revenueCents: number; orders: number; runningTotalCents: number }[]
  topCategories: { categoryId: number; name: string; revenueCents: number; units: number }[]
  topCustomers: { userId: number; name: string; spentCents: number; orders: number }[]
  ratingDistribution: { rating: number; count: number }[]
  mostViewed: { productId: number; name: string; views: number }[]
}>

// ---------- GET /api/social/:userId/network?depth=1..3&limit= ----------
export type NetworkResponse = Traced<{ graph: Graph; countsByDepth: { depth: number; users: number }[] }>
// GET /api/social/:userId/suggestions?limit=
export type SuggestionsResponse = Traced<{
  suggestions: {
    user: { id: number; name: string; city: string }
    mutualCount: number
    distance: number
    mutualNames: string[]
    score: number
  }[]
}>
// GET /api/social/path?from=&to=&maxDepth=
export type PathResponse = Traced<{
  found: boolean
  length: number | null
  graph: Graph
  paths: { id: number; name: string }[][]
}>
// POST /api/social/follow , DELETE /api/social/follow   (body: FollowRequest)
export interface FollowRequest {
  followerId: number
  followeeId: number
}
export type FollowResponse = Traced<{ following: boolean }>
// GET /api/social/:userId/referrals
export type ReferralResponse = Traced<{
  graph: Graph
  levels: { level: number; users: number; revenueCents: number }[]
}>

// ---------- GET /api/recommendations/:userId?strategy=&limit= ----------
export type RecommendationStrategy = 'collaborative' | 'social' | 'category'
export type RecommendationsResponse = Traced<{
  strategy: RecommendationStrategy
  items: RecommendedProduct[]
  graph: Graph
}>

// ---------- GET /api/fraud/rings?minUsers=&limit= , GET /api/fraud/users/:id , GET /api/fraud/referral-cycles ----------
export interface FraudRing {
  id: string
  userIds: number[]
  userNames: string[]
  sharedDevices: number
  sharedCards: number
  sharedAddresses: number
  riskScore: number
}
export type FraudRingsResponse = Traced<{ rings: FraudRing[] }>
export type FraudUserResponse = Traced<{
  user: { id: number; name: string }
  /** 0..100 */
  riskScore: number
  signals: { label: string; detail: string; weight: number }[]
  graph: Graph
}>
export type ReferralCyclesResponse = Traced<{
  cycles: { userIds: number[]; userNames: string[]; length: number }[]
  graph: Graph
}>

// ---------- GET /api/logistics/network , /route?from=&to=&metric= , /fulfillment?productId=&warehouseId= ----------
export type RouteMetric = 'distance' | 'duration' | 'hops'
export type LogisticsNetworkResponse = Traced<{
  warehouses: { id: number; name: string; city: string; lat: number; lng: number }[]
  graph: Graph
}>
export interface RouteResult {
  stops: { id: number; name: string; city: string }[]
  distanceKm: number
  durationMin: number
  hops: number
}
export type RouteResponse = Traced<{
  metric: RouteMetric
  best: RouteResult | null
  alternatives: RouteResult[]
  graph: Graph
}>
/** `warehouseId` is the destination hub; options are warehouses holding the product, best route first. */
export type FulfillmentResponse = Traced<{
  destinationWarehouseId: number
  options: { warehouseId: number; name: string; quantity: number; route: RouteResult }[]
}>

// ---------- Performance lab ----------
export type Row = Record<string, string | number | boolean | null>
export interface ScenarioParamSpec {
  name: string
  label: string
  type: 'number' | 'string'
  default: number | string
  min?: number
  max?: number
}
export interface ScenarioEngineInfo {
  engine: EngineId
  /** Short approach name, e.g. "5-way JOIN + EAV" or "Single document read". */
  label: string
  language: 'sql' | 'javascript' | 'cypher'
  query: string
  notes: string[]
}
export interface ScenarioInfo {
  id: string
  /** 1 = MongoDB lecture, 2 = Neo4j (+ polyglot) lecture. */
  lecture: 1 | 2
  order: number
  title: string
  question: string
  relationalPain: string
  nosqlWin: string
  talkingPoints: string[]
  params: ScenarioParamSpec[]
  engines: ScenarioEngineInfo[]
}
// GET /api/lab/scenarios
export interface ScenarioListResponse {
  scenarios: ScenarioInfo[]
}
// GET /api/lab/scenarios/:id -> ScenarioInfo
// POST /api/lab/scenarios/:id/run
export interface RunScenarioRequest {
  params?: Record<string, number | string>
  iterations?: number
  engines?: EngineId[]
}
export interface EngineRunResult {
  engine: EngineId
  ok: boolean
  error: string | null
  timedOut: boolean
  iterations: number
  minMs: number | null
  medianMs: number | null
  p95Ms: number | null
  rowCount: number
  /** First 50 rows. */
  rows: Row[]
}
export interface RunScenarioResponse {
  scenarioId: string
  params: Record<string, number | string>
  results: EngineRunResult[]
  /** null when fewer than two engines succeeded. */
  resultsMatch: boolean | null
}
// POST /api/lab/scenarios/:id/explain
export interface ExplainRequest {
  engine: EngineId
  params?: Record<string, number | string>
}
export interface ExplainResponse {
  engine: EngineId
  /** Key numbers: e.g. "Documents examined", "DB hits", "Rows examined", "Index used". */
  metrics: { label: string; value: string }[]
  /** Pretty printed plan (EXPLAIN ANALYZE tree, executionStats JSON, PROFILE tree). */
  plan: string
}
// GET /api/lab/report -> { report: latest `bun run bench` output (.data/benchmark-report.json) or null }
export interface BenchmarkReport {
  generatedAt: string
  scale: string
  machine: string
  iterations: number
  results: RunScenarioResponse[]
  /** Extra runs with growing parameters (for example depth 1..5). */
  scaling?: RunScenarioResponse[]
}
export interface BenchmarkReportResponse {
  report: BenchmarkReport | null
}

// ---------- POST /api/checkout/preview  (read only: what we know before the order is placed) ----------
export interface CheckoutPreviewRequest {
  userId: number
  items: { productId: number; quantity: number }[]
  cardFingerprint?: string | null
  deviceId: string
}
export interface LinkedAccount {
  id: number
  name: string
  via: ('device' | 'card' | 'address')[]
}
export type CheckoutPreviewResponse = Traced<{
  items: { product: ProductSummary; quantity: number; available: boolean }[]
  totalCents: number
  trust: {
    level: 'clear' | 'review' | 'high'
    /** 0..100 */
    score: number
    signals: { label: string; detail: string }[]
    /** Other accounts sharing this device, this card or one of the user's shipping addresses. */
    linkedAccounts: LinkedAccount[]
    graph: Graph
  }
  delivery: {
    destination: { warehouseId: number; city: string }
    shipments: {
      productId: number
      productName: string
      /** null when no warehouse stocks the product. */
      from: { warehouseId: number; city: string } | null
      route: RouteResult | null
    }[]
    /** Duration of the slowest shipment; null when nothing can be shipped. */
    estimatedMinutes: number | null
  }
}>

// ---------- GET /api/catalog/products/:id/network?userId=  ("people you know who bought this") ----------
export type ProductNetworkResponse = Traced<{
  buyers: {
    user: { id: number; name: string; city: string }
    /** 1 = you follow them, 2 = followed by someone you follow. */
    distance: number
    /** Names of the people between you and the buyer (empty at distance 1). */
    via: string[]
    rating: number | null
  }[]
  /** All buyers within two hops, not only the listed ones. */
  totalInNetwork: number
  graph: Graph
}>
