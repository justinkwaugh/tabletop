import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, isSpace, neighborsOf, spaceKey, SPACES, stepsFrom } from './geometry.js'

// Every piece remembers the space it was placed on, which tells it apart from the others for as
// long as it stays on the board.
export type DvonnPiece = Type.Static<typeof DvonnPiece>
export const DvonnPiece = Type.Object({ dvonn: Type.Literal(true), placedAt: AxialCoordinates })

export type PlayerPiece = Type.Static<typeof PlayerPiece>
export const PlayerPiece = Type.Object({ playerId: Type.String(), placedAt: AxialCoordinates })

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Union([DvonnPiece, PlayerPiece])

// An occupied space and its stack, listed from the bottom up. Empty spaces are not stored: the
// board's spaces are SPACES.
export type Stack = Type.Static<typeof Stack>
export const Stack = Type.Object({
    coords: AxialCoordinates,
    pieces: Type.Array(Piece, { minItems: 1 })
})

export type DvonnBoard = Type.Static<typeof DvonnBoard>
export const DvonnBoard = Type.Object({
    stacks: Type.Array(Stack)
})

export type RemovedStack = Type.Static<typeof RemovedStack>
export const RemovedStack = Type.Object({
    coords: AxialCoordinates,
    stack: Type.Array(Piece)
})

export function isPlayerPiece(piece: Piece): piece is PlayerPiece {
    return 'playerId' in piece
}

export function isDvonnPiece(piece: Piece): piece is DvonnPiece {
    return 'dvonn' in piece
}

export function stackOwner(stack: readonly Piece[]): string | undefined {
    const top = stack.at(-1)
    return top !== undefined && isPlayerPiece(top) ? top.playerId : undefined
}

export function emptyBoard(): DvonnBoard {
    return { stacks: [] }
}

const DvonnBoardValidator = Compile(DvonnBoard)

export class HydratedDvonnBoard extends Hydratable<typeof DvonnBoard> implements DvonnBoard {
    declare stacks: Stack[]

    constructor(data: DvonnBoard) {
        super(data, DvonnBoardValidator)
    }

    private stackOn(coords: AxialCoordinates): Stack | undefined {
        return this.stacks.find((stack) => sameCoordinates(stack.coords, coords))
    }

    stackAt(coords: AxialCoordinates): readonly Piece[] {
        return this.stackOn(coords)?.pieces ?? []
    }

    isOccupied(coords: AxialCoordinates): boolean {
        return this.stackOn(coords) !== undefined
    }

    ownerAt(coords: AxialCoordinates): string | undefined {
        return stackOwner(this.stackAt(coords))
    }

    vacantSpaces(): AxialCoordinates[] {
        return SPACES.filter((coords) => !this.isOccupied(coords))
    }

    isFull(): boolean {
        return this.stacks.length === SPACES.length
    }

    dvonnCount(): number {
        return this.stacks.reduce(
            (count, stack) => count + stack.pieces.filter(isDvonnPiece).length,
            0
        )
    }

    place(coords: AxialCoordinates, piece: Piece) {
        if (!isSpace(coords) || this.isOccupied(coords)) {
            throw Error('The space is taken')
        }
        this.stacks.push({ coords: { ...coords }, pieces: [piece] })
    }

    // Rule E6: a stack with all six neighbours occupied is blocked; edge spaces have fewer than six.
    private isSurrounded(coords: AxialCoordinates): boolean {
        const neighbors = neighborsOf(coords)
        return (
            neighbors.length === DIRECTIONS.length &&
            neighbors.every((neighbor) => this.isOccupied(neighbor))
        )
    }

    // Rules E3–E5: a stack moves exactly its height in a straight line and lands on an occupied
    // space; empty spaces on the way count.
    destinationsFrom(from: AxialCoordinates): AxialCoordinates[] {
        const height = this.stackAt(from).length
        if (height === 0 || this.isSurrounded(from)) {
            return []
        }
        return DIRECTIONS.map((direction) => stepsFrom(from, direction, height)).filter((to) =>
            this.isOccupied(to)
        )
    }

    canMove(from: AxialCoordinates, to: AxialCoordinates): boolean {
        return this.destinationsFrom(from).some((destination) => sameCoordinates(destination, to))
    }

    stacksOf(playerId: string): AxialCoordinates[] {
        return this.stacks
            .filter((stack) => stackOwner(stack.pieces) === playerId)
            .map((stack) => stack.coords)
    }

    moveStack(from: AxialCoordinates, to: AxialCoordinates) {
        const origin = this.stackOn(from)
        const target = this.stackOn(to)
        assertExists(origin, `No stack at ${from.q},${from.r}`)
        assertExists(target, `No stack at ${to.q},${to.r}`)
        target.pieces.push(...origin.pieces)
        this.stacks = this.stacks.filter((stack) => stack !== origin)
    }

    // Rule F1: every stack that no chain of occupied neighbours links to a DVONN piece leaves the
    // board.
    removeIsolated(): RemovedStack[] {
        const linked = new Set<number>()
        const frontier = this.stacks
            .filter((stack) => stack.pieces.some(isDvonnPiece))
            .map((stack) => stack.coords)
        frontier.forEach((coords) => linked.add(spaceKey(coords)))
        for (let current = frontier.pop(); current !== undefined; current = frontier.pop()) {
            for (const neighbor of neighborsOf(current)) {
                if (this.isOccupied(neighbor) && !linked.has(spaceKey(neighbor))) {
                    linked.add(spaceKey(neighbor))
                    frontier.push(neighbor)
                }
            }
        }

        const isolated = this.stacks.filter((stack) => !linked.has(spaceKey(stack.coords)))
        this.stacks = this.stacks.filter((stack) => linked.has(spaceKey(stack.coords)))
        return isolated.map((stack) => ({ coords: { ...stack.coords }, stack: stack.pieces }))
    }

    piecesOf(playerId: string): number {
        return this.stacks.reduce(
            (count, stack) =>
                count +
                stack.pieces.filter((piece) => isPlayerPiece(piece) && piece.playerId === playerId)
                    .length,
            0
        )
    }

    controlledPieces(playerId: string): number {
        return this.stacks
            .filter((stack) => stackOwner(stack.pieces) === playerId)
            .reduce((count, stack) => count + stack.pieces.length, 0)
    }
}
