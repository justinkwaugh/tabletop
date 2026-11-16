import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, firstOccupiedFrom, isSpace, SPACES } from './geometry.js'

export enum PieceKind {
    Tzaar = 'tzaar',
    Tzarra = 'tzarra',
    Tott = 'tott'
}

export const PIECE_KINDS: readonly PieceKind[] = [PieceKind.Tzaar, PieceKind.Tzarra, PieceKind.Tott]

// Rule A: each player has 6 Tzaars, 9 Tzarras and 15 Totts.
export const PIECES_OF_KIND: Readonly<Record<PieceKind, number>> = {
    [PieceKind.Tzaar]: 6,
    [PieceKind.Tzarra]: 9,
    [PieceKind.Tott]: 15
}

// The id tells a piece apart from the others for as long as it stays on the board.
export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    id: Type.Number(),
    playerId: Type.String(),
    kind: Type.Enum(PieceKind)
})

// An occupied space and its stack, listed from the bottom up. Empty spaces are not stored: the
// board's spaces are SPACES.
export type PieceStack = Type.Static<typeof PieceStack>
export const PieceStack = Type.Object({
    coords: AxialCoordinates,
    pieces: Type.Array(Piece, { minItems: 1 })
})

export type TzaarBoard = Type.Static<typeof TzaarBoard>
export const TzaarBoard = Type.Object({
    stacks: Type.Array(PieceStack)
})

export function emptyBoard(): TzaarBoard {
    return { stacks: [] }
}

const TzaarBoardValidator = Compile(TzaarBoard)

export class HydratedTzaarBoard extends Hydratable<typeof TzaarBoard> implements TzaarBoard {
    declare stacks: PieceStack[]

    constructor(data: TzaarBoard) {
        super(data, TzaarBoardValidator)
    }

    private stackOn(coords: AxialCoordinates): PieceStack | undefined {
        return this.stacks.find((stack) => sameCoordinates(stack.coords, coords))
    }

    private occupiedStack(coords: AxialCoordinates): PieceStack {
        const stack = this.stackOn(coords)
        assertExists(stack, `No stack at ${coords.q},${coords.r}`)
        return stack
    }

    private ownerOf(pieces: readonly Piece[]): string | undefined {
        return pieces.at(-1)?.playerId
    }

    stackAt(coords: AxialCoordinates): readonly Piece[] {
        return this.stackOn(coords)?.pieces ?? []
    }

    isOccupied(coords: AxialCoordinates): boolean {
        return this.stackOn(coords) !== undefined
    }

    ownerAt(coords: AxialCoordinates): string | undefined {
        return this.ownerOf(this.stackAt(coords))
    }

    heightAt(coords: AxialCoordinates): number {
        return this.stackAt(coords).length
    }

    topKindAt(coords: AxialCoordinates): PieceKind | undefined {
        return this.stackAt(coords).at(-1)?.kind
    }

    vacantSpaces(): AxialCoordinates[] {
        return SPACES.filter((coords) => !this.isOccupied(coords))
    }

    isFull(): boolean {
        return this.stacks.length === SPACES.length
    }

    pieceCount(): number {
        return this.stacks.reduce((count, stack) => count + stack.pieces.length, 0)
    }

    piecesOf(playerId: string): Piece[] {
        return this.stacks.flatMap((stack) =>
            stack.pieces.filter((piece) => piece.playerId === playerId)
        )
    }

    stacksOf(playerId: string): AxialCoordinates[] {
        return this.stacks
            .filter((stack) => this.ownerOf(stack.pieces) === playerId)
            .map((stack) => stack.coords)
    }

    // Rule F4 and the reminder in G: only the top piece of each stack counts as a type.
    topsOf(playerId: string, kind: PieceKind): number {
        return this.stacks.filter(
            (stack) => this.ownerOf(stack.pieces) === playerId && stack.pieces.at(-1)?.kind === kind
        ).length
    }

    place(coords: AxialCoordinates, piece: Piece) {
        if (!isSpace(coords) || this.isOccupied(coords)) {
            throw Error('The space is taken')
        }
        this.stacks.push({ coords: { ...coords }, pieces: [piece] })
    }

    reachableFrom(from: AxialCoordinates): AxialCoordinates[] {
        return DIRECTIONS.map((direction) =>
            firstOccupiedFrom(from, direction, (coords) => this.isOccupied(coords))
        ).filter((coords) => coords !== undefined)
    }

    // Rules D and E1–E3: a stack captures an opponent's stack that is at most as high.
    capturesFrom(from: AxialCoordinates): AxialCoordinates[] {
        const owner = this.ownerAt(from)
        const height = this.heightAt(from)
        return this.reachableFrom(from).filter(
            (to) => this.ownerAt(to) !== owner && this.heightAt(to) <= height
        )
    }

    // Rules E b1–b3: a stack may jump onto any of its owner's stacks it can reach.
    stackingTargetsFrom(from: AxialCoordinates): AxialCoordinates[] {
        const owner = this.ownerAt(from)
        return this.reachableFrom(from).filter((to) => this.ownerAt(to) === owner)
    }

    // The moving stack goes on top of the one it reaches and its own space empties.
    moveStack(from: AxialCoordinates, to: AxialCoordinates) {
        const origin = this.occupiedStack(from)
        const target = this.occupiedStack(to)
        target.pieces.push(...origin.pieces)
        this.stacks = this.stacks.filter((stack) => stack !== origin)
    }

    // Rule E1: the captured stack leaves the board and the capturing stack takes its space.
    captureStack(from: AxialCoordinates, to: AxialCoordinates): Piece[] {
        const capturing = this.occupiedStack(from)
        const captured = this.occupiedStack(to)
        this.stacks = this.stacks.filter((stack) => stack !== captured)
        capturing.coords = { ...to }
        return captured.pieces
    }
}
