import type { GraphNode, Graph } from './graph.js'

// Traverses a graph and returns an iterable of nodes
export type Traverser<G extends Graph<T>, T extends GraphNode> = (graph: G) => Iterable<T>
