import { Node, Graph } from './graph.js'

// Traverses a graph and returns an iterable of nodes
export type Traverser<G extends Graph<T>, T extends Node> = (graph: G) => Iterable<T>
