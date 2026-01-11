import type { Direction } from './directions.js'
import type { NodeGenerator } from './generator.js'
import type { Pathfinder } from './pathfinder.js'
import type { Traverser } from './traverser.js'

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
    setNode(node: T): void
    populate(nodes: T[]): void
    populate(generator: NodeGenerator<T>): void
    removeNode(id: NodeIdentifier): void
    removeNode(node: T): void
    has(id: NodeIdentifier): boolean
    has(node: T): boolean
    neighborsOf(node: T, direction?: Direction): T[]
    findPaths(pathfinder: Pathfinder<T>): Iterable<T[]>
    findFirstPath(pathfinder: Pathfinder<T>): T[] | undefined
    traverse(traverser: Traverser<Graph<T>, T>): Iterable<T>
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

    public populate(nodesOrGenerator: T[] | NodeGenerator<T>) {
        if (Array.isArray(nodesOrGenerator)) {
            for (const node of nodesOrGenerator) {
                this.setNode(node)
            }
        } else {
            for (const node of nodesOrGenerator()) {
                this.setNode(node)
            }
        }
    }

    public setNode(node: T) {
        this.nodes[node.id] = node
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
