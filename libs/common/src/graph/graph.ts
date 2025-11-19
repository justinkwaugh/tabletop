import { Direction } from './directions.js'
import { NodeGenerator } from './generator.js'
import { Pathfinder } from './pathfinder.js'
import { Traverser } from './traverser.js'

export type NodeIdentifier = string | number

export function isNodeIdentifier(value: unknown): value is NodeIdentifier {
    return typeof value === 'string' || typeof value === 'number'
}

export interface GraphNode {
    id: NodeIdentifier
}

export interface Graph<T extends GraphNode> extends Iterable<T> {
    readonly size: number

    node(id: NodeIdentifier): T | undefined
    addNode(node: T): void
    addNodes(nodes: T[] | NodeGenerator<T>): void
    removeNode(id: NodeIdentifier): void
    removeNode(node: T): void
    findPaths(pathfinder: Pathfinder<T>): Iterable<T[]>
    findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined
    neighborsOf(node: T, direction?: Direction): T[]
    has(id: NodeIdentifier): boolean
    has(node: T): boolean
    traverse(traverser: Traverser<Graph<T>, T>): Iterable<T>
    findPaths(pathfinder: Pathfinder<T>): Iterable<T[]>
    findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined
}

export abstract class BaseGraph<T extends GraphNode> implements Graph<T> {
    *[Symbol.iterator](): IterableIterator<T> {
        yield* Object.values(this.nodes)
    }

    private nodes: Record<NodeIdentifier, T> = {}

    get size(): number {
        return Object.keys(this.nodes).length
    }

    public node(id: NodeIdentifier): T | undefined {
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

    public has(nodeOrId: T | NodeIdentifier): boolean {
        const id = isNodeIdentifier(nodeOrId) ? nodeOrId : nodeOrId.id
        return !!this.nodes[id]
    }

    public *traverse(traverser: Traverser<Graph<T>, T>): Iterable<T> {
        yield* traverser(this)
    }

    public *findPaths(pathfinder: Pathfinder<T>): Iterable<T[]> {
        yield* pathfinder(this)
    }

    public findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined {
        for (const path of pathfinder(this)) {
            return path
        }
        return undefined
    }
}
