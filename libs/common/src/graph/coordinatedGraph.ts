import { Coordinates, coordinatesToNumber } from './coordinates.js'
import { Direction } from './directions.js'
import { NodeGenerator, patternGenerator } from './generator.js'
import { GraphNode, BaseGraph, Graph } from './graph.js'
import { CoordinatePattern } from './pattern.js'
import { Traverser } from './traverser.js'
import { patternTraverser } from './traversers/pattern.js'

export type CoordinatedNode<T extends Coordinates> = {
    coords: T
} & GraphNode

export type CoordinatedNodeFactory<
    U extends Coordinates,
    T extends CoordinatedNode<U> = CoordinatedNode<U>
> = (coords: U) => T

export function createCoordinatedNode<T extends Coordinates>(coords: T) {
    return { id: coordinatesToNumber(coords), coords }
}

export interface CoordinatedGraph<T extends CoordinatedNode<U>, U extends Coordinates>
    extends Graph<T> {
    nodeAt(coords: U): T | undefined
    neighborsAt(coords: U, direction?: Direction): T[]
    hasAt(coords: U): boolean
    traverse(traverser: Traverser<CoordinatedGraph<T, U>, T>): Iterable<T>
}

export abstract class BaseCoordinatedGraph<T extends CoordinatedNode<U>, U extends Coordinates>
    extends BaseGraph<T>
    implements CoordinatedGraph<T, U>
{
    public populateFromPattern(
        patternOrPatterns: CoordinatePattern<U> | CoordinatePattern<U>[],
        factory: CoordinatedNodeFactory<U, T>
    ) {
        const generator = patternGenerator(patternOrPatterns, factory)
        this.populate(generator)
    }

    public removeNodeAt(coords: U) {
        const nodeId = coordinatesToNumber(coords)
        this.removeNode(nodeId)
    }

    public nodeAt(coords: U): T | undefined {
        return this.node(coordinatesToNumber(coords))
    }

    public abstract neighborsAt(_coords: U, _direction?: Direction): T[]

    public hasAt(coords: U): boolean {
        return this.has(coordinatesToNumber(coords))
    }

    public override *traverse(traverser: Traverser<CoordinatedGraph<T, U>, T>): Iterable<T> {
        yield* traverser(this)
    }

    public *traversePattern(
        patternOrPatterns: CoordinatePattern<U> | CoordinatePattern<U>[]
    ): Iterable<T> {
        const traverser = patternTraverser<T, U>(patternOrPatterns)
        yield* this.traverse(traverser)
    }
}
