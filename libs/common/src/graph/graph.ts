import { Coordinates, coordinatesToNumber } from './coordinates.js'

export type NodeIdentifier = string | number

export interface Node {
    id: NodeIdentifier
}

export type CoordinatedNode<T extends Coordinates> = {
    coords: T
} & Node

export type Direction = string

// Traverses a graph and returns a list of nodes
export type Traverser<T extends Node, R extends Iterable<T> = T[]> = (graph: Graph<T>) => R

// Finds a path through a graph and returns a list of paths
export type Pathfinder<T extends Node, R extends Iterable<T[]> = T[][]> = (graph: Graph<T>) => R

export interface Graph<T extends Node> extends Iterable<T> {
    getNode(id: NodeIdentifier): T | undefined
    neighborsOf(node: T, direction?: Direction): T[]
    contains(node: T): boolean
    traverse(traverser: Traverser<T>): T[]
    size(): number
}

export interface CoordinatedGraph<T extends CoordinatedNode<U>, U extends Coordinates>
    extends Graph<T> {
    nodeAt(coords: U): T | undefined
    neighborsAt(coords: U, direction?: Direction): T[]
    hasAt(coords: U): boolean
}

export class BaseGraph<T extends Node> implements Graph<T> {
    *[Symbol.iterator](): IterableIterator<T> {
        yield* Object.values(this.nodes)
    }

    *map<V>(callback: (node: T) => V): IterableIterator<V> {
        for (const node of this) {
            yield callback(node)
        }
    }

    private nodes: Record<NodeIdentifier, T> = {}

    public size(): number {
        return Object.keys(this.nodes).length
    }

    public getNode(id: NodeIdentifier): T | undefined {
        return this.nodes[id]
    }

    public addNode(node: T) {
        this.nodes[node.id] = node
    }

    public removeNode(node: T) {
        this.removeNodeById(node.id)
    }

    public removeNodeById(id: NodeIdentifier) {
        delete this.nodes[id]
    }

    public neighborsOf(_node: T, _direction?: Direction): T[] {
        throw new Error('Not implemented')
    }

    public contains(node: T): boolean {
        return !!this.nodes[node.id]
    }

    public traverse(traverser: Traverser<T>): T[] {
        return traverser(this)
    }

    public findPaths(pathfinder: Pathfinder<T>): T[][] {
        return pathfinder(this)
    }

    public findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined {
        const paths = pathfinder(this)
        return paths.length > 0 ? paths[0] : undefined
    }
}

export class BaseCoordinatedGraph<
    T extends CoordinatedNode<U>,
    U extends Coordinates
> extends BaseGraph<T> {
    public removeNodeAt(coords: U) {
        const nodeId = coordinatesToNumber(coords)
        this.removeNodeById(nodeId)
    }

    public nodeAt(coords: U): T | undefined {
        return this.getNode(coordinatesToNumber(coords))
    }

    public neighborsAt(_coords: U, _direction?: Direction): T[] {
        throw new Error('Not implemented')
    }

    public hasAt(coords: U): boolean {
        return !!this.nodeAt(coords)
    }
}
