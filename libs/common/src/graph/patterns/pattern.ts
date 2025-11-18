import { Coordinates } from '../coordinates.js'

//export type Traverser<T extends Node, R extends Iterable<T> = T[]> = (graph: Graph<T>) => R
export type CoordinatePattern<T extends Coordinates> = () => Iterable<T>
