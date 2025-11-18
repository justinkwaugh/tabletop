import { NodeGenerator } from './generator.js'
import { Pathfinder } from './pathfinder.js'
import { Traverser } from './traverser.js'

export type NodeIdentifier = string | number
export function isNodeIdentifier(value: unknown): value is NodeIdentifier {
    return typeof value === 'string' || typeof value === 'number'
}

export interface Node {
    id: NodeIdentifier
}

// Represents a direction in a graph
export type Direction = string

export interface Graph<T extends Node> extends Iterable<T> {
    getNode(id: NodeIdentifier): T | undefined
    addNode(node: T): void
    addNodes(nodes: T[] | NodeGenerator<T>): void
    removeNode(id: NodeIdentifier): void
    removeNode(node: T): void
    findPaths(pathfinder: Pathfinder<T>): T[][]
    findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined
    neighborsOf(node: T, direction?: Direction): T[]
    contains(id: NodeIdentifier): boolean
    contains(node: T): boolean
    traverse(traverser: Traverser<Graph<T>, T>): Iterable<T>
    size(): number
}

export abstract class BaseGraph<T extends Node> implements Graph<T> {
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

    public addNodes(nodes: T[] | NodeGenerator<T>) {
        if (Array.isArray(nodes)) {
            for (const node of nodes) {
                this.addNode(node)
            }
        } else {
            for (const node of nodes()) {
                this.addNode(node)
            }
        }
    }

    public removeNode(nodeOrId: T | NodeIdentifier): T | undefined {
        const id = isNodeIdentifier(nodeOrId) ? nodeOrId : nodeOrId.id
        const node = this.nodes[id]
        delete this.nodes[id]
        return node
    }

    public abstract neighborsOf(_node: T, _direction?: Direction): T[]

    public contains(nodeOrId: T | NodeIdentifier): boolean {
        const id = isNodeIdentifier(nodeOrId) ? nodeOrId : nodeOrId.id
        return !!this.nodes[id]
    }

    public traverse(traverser: Traverser<Graph<T>, T>): Iterable<T> {
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
