import { Node, Graph } from './graph.js'

// Finds a path through a graph and returns a list of paths
export type Pathfinder<T extends Node, R extends Iterable<T[]> = T[][]> = (graph: Graph<T>) => R
