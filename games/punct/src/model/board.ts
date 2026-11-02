import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, Hydratable, sameCoordinates } from '@tabletop/common'
import {
    AXES,
    BOARD_RADIUS,
    CENTRE_SPACES,
    DIRECTIONS,
    isCentre,
    isSpace,
    lineFrom,
    neighbours,
    SPACES,
    spaceKey
} from './geometry.js'
import { dotsOf, PieceKind, rotationsOf, spanOf } from './pieces.js'

// A piece in play: where its PÜNCT lies, which way its minor dots turn, and the level it rests
// on (0 on the board). Ids are given as pieces enter the board.
export type PlacedPiece = Type.Static<typeof PlacedPiece>
export const PlacedPiece = Type.Object({
    id: Type.Integer({ minimum: 0 }),
    playerId: Type.String(),
    kind: Type.Enum(PieceKind),
    punct: AxialCoordinates,
    rotation: Type.Integer({ minimum: 0, maximum: 5 }),
    level: Type.Integer({ minimum: 0 })
})

export type PunctBoard = Type.Static<typeof PunctBoard>
export const PunctBoard = Type.Object({
    pieces: Type.Array(PlacedPiece)
})

// One dot of a piece over a space.
export type Layer = { piece: PlacedPiece; dot: number }

export type Placement = { punct: AxialCoordinates; rotation: number; level: number }

const PunctBoardValidator = Compile(PunctBoard)

// Dots by space, lowest first, kept outside the board so they never reach its saved state.
const occupancies = new WeakMap<HydratedPunctBoard, Map<number, Layer[]>>()

export function emptyBoard(): PunctBoard {
    return { pieces: [] }
}

export class HydratedPunctBoard extends Hydratable<typeof PunctBoard> implements PunctBoard {
    declare pieces: PlacedPiece[]

    constructor(data: PunctBoard) {
        super(data, PunctBoardValidator)
    }

    pieceById(id: number): PlacedPiece | undefined {
        return this.pieces.find((piece) => piece.id === id)
    }

    dotsOf(piece: PlacedPiece): AxialCoordinates[] {
        return dotsOf(piece.kind, piece.punct, piece.rotation)
    }

    // Every dot over a space, lowest first, leaving out one piece (one being moved).
    layersAt(coords: AxialCoordinates, ignoredId?: number): Layer[] {
        const layers = this.occupancy().get(spaceKey(coords)) ?? []
        return ignoredId === undefined
            ? layers
            : layers.filter((layer) => layer.piece.id !== ignoredId)
    }

    private occupancy(): Map<number, Layer[]> {
        const cached = occupancies.get(this)
        if (cached !== undefined) {
            return cached
        }
        const occupancy = new Map<number, Layer[]>()
        for (const piece of this.pieces) {
            this.dotsOf(piece).forEach((dot, index) => {
                const layers = occupancy.get(spaceKey(dot)) ?? []
                layers.push({ piece, dot: index })
                occupancy.set(spaceKey(dot), layers)
            })
        }
        for (const layers of occupancy.values()) {
            layers.sort((a, b) => a.piece.level - b.piece.level)
        }
        occupancies.set(this, occupancy)
        return occupancy
    }

    // The level the next piece over a space would rest on: one above its top dot.
    heightAt(coords: AxialCoordinates, ignoredId?: number): number {
        const layers = this.layersAt(coords, ignoredId)
        return layers.length === 0 ? 0 : layers[layers.length - 1].piece.level + 1
    }

    // The dot seen from above.
    topAt(coords: AxialCoordinates, ignoredId?: number): Layer | undefined {
        return this.layersAt(coords, ignoredId).at(-1)
    }

    // Rule 3/3: a piece with any dot covered, or bridged over, may not move or turn.
    isCovered(piece: PlacedPiece): boolean {
        return this.dotsOf(piece).some((dot) => this.heightAt(dot) > piece.level + 1)
    }

    // The pieces with a dot right under one of the piece's own.
    piecesUnder(piece: PlacedPiece): PlacedPiece[] {
        const under = this.dotsOf(piece).flatMap((dot) =>
            this.layersAt(dot).filter((layer) => layer.piece.level === piece.level - 1)
        )
        return [...new Set(under.map((layer) => layer.piece))]
    }

    // Rule 1/1: a new piece goes on the board itself, each dot on an empty space, kept out of
    // the central hexagon when the rule asks.
    canEnter(
        kind: PieceKind,
        punct: AxialCoordinates,
        rotation: number,
        outsideCentre: boolean
    ): boolean {
        return dotsOf(kind, punct, rotation).every(
            (dot) => isSpace(dot) && this.heightAt(dot) === 0 && !(outsideCentre && isCentre(dot))
        )
    }

    // The level a piece would rest on with its PÜNCT on a space, or undefined if it cannot.
    // Rules 3/1–3/4 and 4/1–4/4: on the board, or on top of pieces with every dot at one level
    // and its PÜNCT on one of the player's own; a straight or angular piece can instead bridge
    // between its two ends with its middle dot over anything lower. A PÜNCT in the middle of a
    // bridge must still lie over one of the player's own pieces.
    levelFor(
        playerId: string,
        kind: PieceKind,
        punct: AxialCoordinates,
        rotation: number,
        movingId?: number
    ): number | undefined {
        const dots = dotsOf(kind, punct, rotation)
        if (!dots.every(isSpace)) {
            return undefined
        }
        const heights = dots.map((dot) => this.heightAt(dot, movingId))
        const level = this.restingLevel(kind, heights)
        if (level === undefined) {
            return undefined
        }
        if (level > 0 && this.topAt(punct, movingId)?.piece.playerId !== playerId) {
            return undefined
        }
        return level
    }

    private restingLevel(kind: PieceKind, heights: number[]): number | undefined {
        if (heights.every((height) => height === heights[0])) {
            return heights[0]
        }
        const span = spanOf(kind)
        if (span === undefined) {
            return undefined
        }
        const level = heights[span.ends[0]]
        return level > 0 && heights[span.ends[1]] === level && heights[span.middle] < level
            ? level
            : undefined
    }

    // Rule 2/2: the PÜNCT moves along a straight line any distance, over anything, or stays
    // put while the piece turns; turning it back to where it was is no move.
    movesOf(piece: PlacedPiece): Placement[] {
        if (this.isCovered(piece)) {
            return []
        }
        return this.targetsOf(piece).flatMap((punct) =>
            rotationsOf(piece.kind).flatMap((rotation) => {
                if (sameCoordinates(punct, piece.punct) && rotation === piece.rotation) {
                    return []
                }
                const level = this.levelFor(piece.playerId, piece.kind, punct, rotation, piece.id)
                return level === undefined ? [] : [{ punct, rotation, level }]
            })
        )
    }

    movablePieces(playerId: string): PlacedPiece[] {
        return this.pieces.filter(
            (piece) => piece.playerId === playerId && this.movesOf(piece).length > 0
        )
    }

    canMove(playerId: string): boolean {
        return this.pieces.some(
            (piece) =>
                piece.playerId === playerId &&
                !this.isCovered(piece) &&
                this.targetsOf(piece).some((punct) =>
                    rotationsOf(piece.kind).some(
                        (rotation) =>
                            !(sameCoordinates(punct, piece.punct) && rotation === piece.rotation) &&
                            this.levelFor(piece.playerId, piece.kind, punct, rotation, piece.id) !==
                                undefined
                    )
                )
        )
    }

    private targetsOf(piece: PlacedPiece): AxialCoordinates[] {
        return [piece.punct, ...DIRECTIONS.flatMap((step) => lineFrom(piece.punct, step))]
    }

    place(piece: PlacedPiece) {
        this.pieces.push(piece)
        occupancies.delete(this)
    }

    move(piece: PlacedPiece, placement: Placement) {
        piece.punct = placement.punct
        piece.rotation = placement.rotation
        piece.level = placement.level
        occupancies.delete(this)
    }

    // The spaces whose top dot is the player's.
    controlled(playerId: string): AxialCoordinates[] {
        const keys = new Set<number>()
        const spaces: AxialCoordinates[] = []
        for (const piece of this.pieces) {
            for (const dot of this.dotsOf(piece)) {
                if (keys.has(spaceKey(dot))) continue
                keys.add(spaceKey(dot))
                if (this.topAt(dot)?.piece.playerId === playerId) {
                    spaces.push(dot)
                }
            }
        }
        return spaces
    }

    // Standard game goal 2: the central spaces the player controls.
    centreCount(playerId: string): number {
        return CENTRE_SPACES.filter((coords) => this.topAt(coords)?.piece.playerId === playerId)
            .length
    }

    // Rule C: a chain of the player's visible dots from one side to the opposite side, at any
    // levels. Returns the chain's spaces, or undefined.
    connection(playerId: string): AxialCoordinates[] | undefined {
        const owned = new Map(this.controlled(playerId).map((coords) => [spaceKey(coords), coords]))
        const seen = new Set<number>()
        for (const [key, start] of owned) {
            if (seen.has(key)) continue
            const group = this.groupFrom(start, owned, seen)
            if (AXES.some((axis) => this.spansAxis(group, axis))) {
                return group
            }
        }
        return undefined
    }

    private groupFrom(
        start: AxialCoordinates,
        owned: Map<number, AxialCoordinates>,
        seen: Set<number>
    ): AxialCoordinates[] {
        const group: AxialCoordinates[] = []
        const queue = [start]
        seen.add(spaceKey(start))
        while (queue.length > 0) {
            const current = queue.pop()
            if (current === undefined) break
            group.push(current)
            for (const next of neighbours(current)) {
                const key = spaceKey(next)
                if (!seen.has(key) && owned.has(key)) {
                    seen.add(key)
                    queue.push(next)
                }
            }
        }
        return group
    }

    private spansAxis(
        group: AxialCoordinates[],
        axis: (coords: AxialCoordinates) => number
    ): boolean {
        const values = group.map(axis)
        return values.includes(-BOARD_RADIUS) && values.includes(BOARD_RADIUS)
    }

    entriesOf(kind: PieceKind, outsideCentre: boolean): Placement[] {
        return SPACES.flatMap((punct) =>
            rotationsOf(kind).flatMap((rotation) =>
                this.canEnter(kind, punct, rotation, outsideCentre)
                    ? [{ punct, rotation, level: 0 }]
                    : []
            )
        )
    }
}
