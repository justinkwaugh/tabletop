import { GraphNode } from './graph.js'

// Generates nodes for a graph
export type NodeGenerator<T extends GraphNode> = () => Iterable<T>
