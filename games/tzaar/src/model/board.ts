import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, firstOccupiedFrom, spaceKey, SPACES } from './geometry.js'

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

// A stack lists its pieces from the bottom up.
export type Space = Type.Static<typeof Space>
export const Space = Type.Object({
    coords: AxialCoordinates,
    stack: Type.Array(Piece)
})

export type TzaarBoard = Type.Static<typeof TzaarBoard>
export const TzaarBoard = Type.Object({
    spaces: Type.Array(Space)
})

export function stackOwner(stack: readonly Piece[]): string | undefined {
    return stack.at(-1)?.playerId
}

export function emptyBoard(): TzaarBoard {
    return { spaces: SPACES.map((coords) => ({ coords: { ...coords }, stack: [] })) }
}

const TzaarBoardValidator = Compile(TzaarBoard)

export class HydratedTzaarBoard extends Hydratable<typeof TzaarBoard> implements TzaarBoard {
    declare spaces: Space[]

    constructor(data: TzaarBoard) {
        super(data, TzaarBoardValidator)
    }

    private spaceAt(coords: AxialCoordinates): Space {
        const key = spaceKey(coords)
        const space = this.spaces.find((candidate) => spaceKey(candidate.coords) === key)
        if (space === undefined) {
            throw Error(`No space at ${coords.q},${coords.r}`)
        }
        return space
    }

    stackAt(coords: AxialCoordinates): readonly Piece[] {
        return this.spaceAt(coords).stack
    }

    isOccupied(coords: AxialCoordinates): boolean {
        return this.spaceAt(coords).stack.length > 0
    }

    ownerAt(coords: AxialCoordinates): string | undefined {
        return stackOwner(this.stackAt(coords))
    }

    heightAt(coords: AxialCoordinates): number {
        return this.stackAt(coords).length
    }

    vacantSpaces(): AxialCoordinates[] {
        return this.spaces.filter((space) => space.stack.length === 0).map((space) => space.coords)
    }

    isFull(): boolean {
        return this.spaces.every((space) => space.stack.length > 0)
    }

    pieceCount(): number {
        return this.spaces.reduce((count, space) => count + space.stack.length, 0)
    }

    piecesOf(playerId: string): Piece[] {
        return this.spaces.flatMap((space) =>
            space.stack.filter((piece) => piece.playerId === playerId)
        )
    }

    stacksOf(playerId: string): AxialCoordinates[] {
        return this.spaces
            .filter((space) => stackOwner(space.stack) === playerId)
            .map((space) => space.coords)
    }

    // Rule F4 and the reminder in G: only the top piece of each stack counts as a type.
    topsOf(playerId: string, kind: PieceKind): number {
        return this.spaces.filter(
            (space) => stackOwner(space.stack) === playerId && space.stack.at(-1)?.kind === kind
        ).length
    }

    place(coords: AxialCoordinates, piece: Piece) {
        const space = this.spaceAt(coords)
        if (space.stack.length > 0) {
            throw Error('The space is taken')
        }
        space.stack.push(piece)
    }

    reachableFrom(from: AxialCoordinates): AxialCoordinates[] {
        return DIRECTIONS.map((direction) =>
            firstOccupiedFrom(from, direction, (coords) => this.isOccupied(coords))
        ).filter((coords) => coords !== undefined)
    }

    canReach(from: AxialCoordinates, to: AxialCoordinates): boolean {
        return this.reachableFrom(from).some((reached) => sameCoordinates(reached, to))
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

    // The moving stack goes on top of the one it reaches; a capture first takes that stack away.
    moveStack(from: AxialCoordinates, to: AxialCoordinates) {
        const origin = this.spaceAt(from)
        this.spaceAt(to).stack.push(...origin.stack)
        origin.stack = []
    }

    removeStack(coords: AxialCoordinates): Piece[] {
        const space = this.spaceAt(coords)
        const removed = space.stack
        space.stack = []
        return removed
    }
}
