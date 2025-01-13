import { Coordinates, coordinatesToNumber } from '@tabletop/common'

export type Node<T extends Coordinates> = {
    coords: T
}

export type Direction = string

// Traverses a graph and returns a list of nodes
export type Traverser<T extends Node<U>, U extends Coordinates, R extends Iterable<T> = T[]> = (
    graph: Graph<T, U>
) => R

// Finds a path through a graph and returns a list of paths
export type Pathfinder<
    T extends Node<U>,
    U extends Coordinates,
    R extends Iterable<T[]> = T[][]
> = (graph: Graph<T, U>) => R

export interface Graph<T extends Node<U>, U extends Coordinates> extends Iterable<T> {
    nodeAt(coords: U): T | undefined
    neighborsOf(coords: U, direction?: Direction): T[]
    contains(coords: U): boolean
    traverse(traverser: Traverser<T, U>): T[]
    nodeCount(): number
}

export class BaseGraph<T extends Node<U>, U extends Coordinates> implements Graph<T, U> {
    *[Symbol.iterator](): IterableIterator<T> {
        yield* Object.values(this.nodes)
    }

    *map<V>(callback: (node: T) => V): IterableIterator<V> {
        for (const node of this) {
            yield callback(node)
        }
    }

    private nodes: Record<number, T> = {}

    public nodeCount(): number {
        return Object.keys(this.nodes).length
    }

    public addNode(node: T) {
        const nodeId = coordinatesToNumber(node.coords)
        this.nodes[nodeId] = node
    }

    public removeNode(node: T) {
        const nodeId = coordinatesToNumber(node.coords)
        delete this.nodes[nodeId]
    }

    public removeNodeAt(coords: U) {
        const nodeId = coordinatesToNumber(coords)
        delete this.nodes[nodeId]
    }

    public nodeAt(coords: U): T {
        return this.nodes[coordinatesToNumber(coords)]
    }

    public neighborsOf(_coords: U, _direction?: Direction): T[] {
        throw new Error('Not implemented')
    }

    public contains(coords: U): boolean {
        return !!this.nodeAt(coords)
    }

    public traverse(traverser: Traverser<T, U>): T[] {
        return traverser(this)
    }

    public findPath(pathfinder: Pathfinder<T, U>): T[][] {
        return pathfinder(this)
    }
}
