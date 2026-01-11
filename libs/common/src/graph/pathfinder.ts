import type { GraphNode, Graph } from './graph.js'

// Finds a path through a graph and returns a list of paths
export type Pathfinder<T extends GraphNode> = (graph: Graph<T>) => Iterable<T[]>
