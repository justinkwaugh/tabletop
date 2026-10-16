import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addAxial,
    AxialCoordinates,
    Hydratable,
    sameCoordinates,
    scaleAxial
} from '@tabletop/common'
import { AXES, ENTRIES, isSpot, pointKey, SPOTS, type Entry } from './geometry.js'

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    playerId: Type.String(),
    gipf: Type.Boolean()
})

export type Spot = Type.Static<typeof Spot>
export const Spot = Type.Object({
    coords: AxialCoordinates,
    piece: Type.Optional(Piece)
})

export type GipfBoard = Type.Static<typeof GipfBoard>
export const GipfBoard = Type.Object({
    spots: Type.Array(Spot)
})

// A row is four or more adjacent pieces of one player in a line. Its reach runs on in both
// directions while spots are occupied; every piece in the reach goes when the row is taken.
export type Row = {
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
    reach: AxialCoordinates[]
}

export type RemovedPiece = Piece & { coords: AxialCoordinates }

const ROW_LENGTH = 4
const GipfBoardValidator = Compile(GipfBoard)

export function emptyBoard(): GipfBoard {
    return { spots: SPOTS.map((coords) => ({ coords: { ...coords } })) }
}

export class HydratedGipfBoard extends Hydratable<typeof GipfBoard> implements GipfBoard {
    declare spots: Spot[]

    constructor(data: GipfBoard) {
        super(data, GipfBoardValidator)
    }

    private spotAt(coords: AxialCoordinates): Spot | undefined {
        const key = pointKey(coords)
        return this.spots.find((spot) => pointKey(spot.coords) === key)
    }

    pieceAt(coords: AxialCoordinates): Piece | undefined {
        return this.spotAt(coords)?.piece
    }

    place(coords: AxialCoordinates, piece: Piece) {
        const spot = this.spotAt(coords)
        if (spot === undefined) {
            throw Error(`No spot at ${coords.q},${coords.r}`)
        }
        spot.piece = { ...piece }
    }

    pieces(): RemovedPiece[] {
        return this.spots.flatMap((spot) =>
            spot.piece === undefined ? [] : [{ ...spot.piece, coords: spot.coords }]
        )
    }

    gipfPiecesOf(playerId: string): number {
        return this.pieces().filter((piece) => piece.gipf && piece.playerId === playerId).length
    }

    isFull(): boolean {
        return this.spots.every((spot) => spot.piece !== undefined)
    }

    findEntry(dot: AxialCoordinates, firstSpot: AxialCoordinates): Entry | undefined {
        return ENTRIES.find(
            (entry) => sameCoordinates(entry.dot, dot) && sameCoordinates(entry.line[0], firstSpot)
        )
    }

    // A push needs room: some spot on its line must be empty, or a piece would leave the board.
    canPush(entry: Entry): boolean {
        return entry.line.some((coords) => this.pieceAt(coords) === undefined)
    }

    legalEntries(): Entry[] {
        return ENTRIES.filter((entry) => this.canPush(entry))
    }

    push(entry: Entry, piece: Piece) {
        const gap = entry.line.findIndex((coords) => this.pieceAt(coords) === undefined)
        if (gap < 0) {
            throw Error('The line is full')
        }
        for (let index = gap; index > 0; index--) {
            const moving = this.spotAt(entry.line[index - 1])?.piece
            const target = this.spotAt(entry.line[index])
            if (target !== undefined && moving !== undefined) {
                target.piece = { ...moving }
            }
        }
        this.place(entry.line[0], piece)
    }

    rows(): Row[] {
        const rows: Row[] = []
        for (const axis of AXES) {
            const starts = SPOTS.filter((coords) => !isSpot(addAxial(coords, scaleAxial(axis, -1))))
            for (const start of starts) {
                let current = start
                let run: AxialCoordinates[] = []
                let runOwner: string | undefined
                const close = () => {
                    if (runOwner !== undefined && run.length >= ROW_LENGTH) {
                        rows.push(this.rowFrom(runOwner, run, axis))
                    }
                }
                while (isSpot(current)) {
                    const owner = this.pieceAt(current)?.playerId
                    if (owner !== undefined && owner === runOwner) {
                        run.push(current)
                    } else {
                        close()
                        run = owner === undefined ? [] : [current]
                        runOwner = owner
                    }
                    current = addAxial(current, axis)
                }
                close()
            }
        }
        return rows
    }

    private rowFrom(playerId: string, run: AxialCoordinates[], axis: AxialCoordinates): Row {
        const reach = [...run]
        let before = addAxial(run[0], scaleAxial(axis, -1))
        while (isSpot(before) && this.pieceAt(before) !== undefined) {
            reach.unshift(before)
            before = addAxial(before, scaleAxial(axis, -1))
        }
        let after = addAxial(run[run.length - 1], axis)
        while (isSpot(after) && this.pieceAt(after) !== undefined) {
            reach.push(after)
            after = addAxial(after, axis)
        }
        return { playerId, from: run[0], to: run[run.length - 1], reach }
    }

    rowsOf(playerId: string): Row[] {
        return this.rows().filter((row) => row.playerId === playerId)
    }

    // GIPF-pieces may always stay, so a row whose reach holds only GIPF-pieces need not be taken.
    isMandatory(row: Row): boolean {
        return row.reach.some((coords) => this.pieceAt(coords)?.gipf === false)
    }

    findRow(playerId: string, from: AxialCoordinates, to: AxialCoordinates): Row | undefined {
        return this.rowsOf(playerId).find(
            (row) =>
                (sameCoordinates(row.from, from) && sameCoordinates(row.to, to)) ||
                (sameCoordinates(row.from, to) && sameCoordinates(row.to, from))
        )
    }

    remove(coords: AxialCoordinates): Piece {
        const spot = this.spotAt(coords)
        if (spot?.piece === undefined) {
            throw Error(`No piece at ${coords.q},${coords.r}`)
        }
        const piece = spot.piece
        delete spot.piece
        return piece
    }
}
