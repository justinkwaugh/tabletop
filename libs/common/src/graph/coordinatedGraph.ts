import { Coordinates, coordinatesToNumber } from './coordinates.js'
import { Node, BaseGraph, Direction, Graph, Traverser } from './graph.js'

export type CoordinatedNode<T extends Coordinates> = {
    coords: T
} & Node

export interface CoordinatedGraph<T extends CoordinatedNode<U>, U extends Coordinates>
    extends Graph<T> {
    nodeAt(coords: U): T | undefined
    neighborsAt(coords: U, direction?: Direction): T[]
    hasAt(coords: U): boolean
    traverse(traverser: Traverser<CoordinatedGraph<T, U>, T>): Iterable<T>
}

export abstract class BaseCoordinatedGraph<
    T extends CoordinatedNode<U>,
    U extends Coordinates
> extends BaseGraph<T> {
    public removeNodeAt(coords: U) {
        const nodeId = coordinatesToNumber(coords)
        this.removeNode(nodeId)
    }

    public nodeAt(coords: U): T | undefined {
        return this.getNode(coordinatesToNumber(coords))
    }

    public abstract neighborsAt(_coords: U, _direction?: Direction): T[]

    public hasAt(coords: U): boolean {
        return !!this.nodeAt(coords)
    }

    public override traverse(traverser: Traverser<CoordinatedGraph<T, U>, T>): Iterable<T> {
        return traverser(this)
    }
}
