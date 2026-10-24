import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import { DIRECTIONS, isSpace, neighborsOf, spaceKey, SPACES, stepsFrom } from './geometry.js'

// Every piece remembers the space it was placed on, which tells it apart from the others for as
// long as it stays on the board.
export type DvonnPiece = Type.Static<typeof DvonnPiece>
export const DvonnPiece = Type.Object({ dvonn: Type.Literal(true), placedAt: AxialCoordinates })

export type PlayerPiece = Type.Static<typeof PlayerPiece>
export const PlayerPiece = Type.Object({ playerId: Type.String(), placedAt: AxialCoordinates })

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Union([DvonnPiece, PlayerPiece])

// A stack lists its pieces from the bottom up.
export type Space = Type.Static<typeof Space>
export const Space = Type.Object({
    coords: AxialCoordinates,
    stack: Type.Array(Piece)
})

export type DvonnBoard = Type.Static<typeof DvonnBoard>
export const DvonnBoard = Type.Object({
    spaces: Type.Array(Space)
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
    return { spaces: SPACES.map((coords) => ({ coords: { ...coords }, stack: [] })) }
}

const DvonnBoardValidator = Compile(DvonnBoard)

export class HydratedDvonnBoard extends Hydratable<typeof DvonnBoard> implements DvonnBoard {
    declare spaces: Space[]

    constructor(data: DvonnBoard) {
        super(data, DvonnBoardValidator)
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
        return isSpace(coords) && this.spaceAt(coords).stack.length > 0
    }

    ownerAt(coords: AxialCoordinates): string | undefined {
        return stackOwner(this.stackAt(coords))
    }

    vacantSpaces(): AxialCoordinates[] {
        return this.spaces.filter((space) => space.stack.length === 0).map((space) => space.coords)
    }

    isFull(): boolean {
        return this.spaces.every((space) => space.stack.length > 0)
    }

    dvonnCount(): number {
        return this.spaces.reduce(
            (count, space) => count + space.stack.filter(isDvonnPiece).length,
            0
        )
    }

    place(coords: AxialCoordinates, piece: Piece) {
        const space = this.spaceAt(coords)
        if (space.stack.length > 0) {
            throw Error('The space is taken')
        }
        space.stack.push(piece)
    }

    // Rule E6: a stack with all six neighbours occupied is blocked; edge spaces have fewer than six.
    isSurrounded(coords: AxialCoordinates): boolean {
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
        return this.spaces
            .filter((space) => stackOwner(space.stack) === playerId)
            .map((space) => space.coords)
    }

    moveStack(from: AxialCoordinates, to: AxialCoordinates) {
        const origin = this.spaceAt(from)
        this.spaceAt(to).stack.push(...origin.stack)
        origin.stack = []
    }

    // Rule F1: every stack that no chain of occupied neighbours links to a DVONN piece leaves the
    // board.
    removeIsolated(): RemovedStack[] {
        const linked = new Set<number>()
        const frontier = this.spaces
            .filter((space) => space.stack.some(isDvonnPiece))
            .map((space) => space.coords)
        frontier.forEach((coords) => linked.add(spaceKey(coords)))
        for (let current = frontier.pop(); current !== undefined; current = frontier.pop()) {
            for (const neighbor of neighborsOf(current)) {
                if (this.isOccupied(neighbor) && !linked.has(spaceKey(neighbor))) {
                    linked.add(spaceKey(neighbor))
                    frontier.push(neighbor)
                }
            }
        }

        const removed: RemovedStack[] = []
        for (const space of this.spaces) {
            if (space.stack.length > 0 && !linked.has(spaceKey(space.coords))) {
                removed.push({ coords: { ...space.coords }, stack: space.stack })
                space.stack = []
            }
        }
        return removed
    }

    piecesOf(playerId: string): number {
        return this.spaces.reduce(
            (count, space) =>
                count +
                space.stack.filter((piece) => isPlayerPiece(piece) && piece.playerId === playerId)
                    .length,
            0
        )
    }

    controlledPieces(playerId: string): number {
        return this.spaces
            .filter((space) => stackOwner(space.stack) === playerId)
            .reduce((count, space) => count + space.stack.length, 0)
    }
}
