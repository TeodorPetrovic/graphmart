/**
 * Safety net for interactive graph queries. Normal runs take milliseconds; the first run on a
 * cold database also plans the query and loads pages from disk, so the limit is generous.
 */
export const GRAPH_TIMEOUT_MS = 10_000
