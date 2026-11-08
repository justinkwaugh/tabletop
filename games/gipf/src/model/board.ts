import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addAxial,
    assertExists,
    AxialCoordinates,
    Hydratable,
    sameCoordinates,
    scaleAxial
} from '@tabletop/common'
import { AXES, ENTRIES, isSpot, SPOTS, type Entry } from './geometry.js'

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    playerId: Type.String(),
    gipf: Type.Boolean()
})

export type BoardPiece = Type.Static<typeof BoardPiece>
export const BoardPiece = Type.Object({
    coords: AxialCoordinates,
    playerId: Type.String(),
    gipf: Type.Boolean()
})

export type GipfBoard = Type.Static<typeof GipfBoard>
export const GipfBoard = Type.Object({
    pieces: Type.Array(BoardPiece)
})

// A row's reach runs on while spots are occupied; every piece in it goes when the row is taken.
export type Row = {
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
    reach: AxialCoordinates[]
}

const ROW_LENGTH = 4
const GIPF_PIECE_SIZE = 2
const GipfBoardValidator = Compile(GipfBoard)

export function piecesIn(gipf: boolean): number {
    return gipf ? GIPF_PIECE_SIZE : 1
}

export function emptyBoard(): GipfBoard {
    return { pieces: [] }
}

export class HydratedGipfBoard extends Hydratable<typeof GipfBoard> implements GipfBoard {
    declare pieces: BoardPiece[]

    constructor(data: GipfBoard) {
        super(data, GipfBoardValidator)
    }

    private boardPieceAt(coords: AxialCoordinates): BoardPiece | undefined {
        return this.pieces.find((piece) => sameCoordinates(piece.coords, coords))
    }

    pieceAt(coords: AxialCoordinates): Piece | undefined {
        const found = this.boardPieceAt(coords)
        return found === undefined ? undefined : { playerId: found.playerId, gipf: found.gipf }
    }

    place(coords: AxialCoordinates, piece: Piece) {
        if (!isSpot(coords)) {
            throw Error(`No spot at ${coords.q},${coords.r}`)
        }
        if (this.boardPieceAt(coords) !== undefined) {
            throw Error(`A piece already stands at ${coords.q},${coords.r}`)
        }
        this.pieces.push({ coords: { ...coords }, playerId: piece.playerId, gipf: piece.gipf })
    }

    gipfPiecesOf(playerId: string): number {
        return this.pieces.filter((piece) => piece.gipf && piece.playerId === playerId).length
    }

    isFull(): boolean {
        return this.pieces.length === SPOTS.length
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
            const moving = this.boardPieceAt(entry.line[index - 1])
            assertExists(moving, 'Every spot before the gap holds a piece')
            moving.coords = { ...entry.line[index] }
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
        const index = this.pieces.findIndex((piece) => sameCoordinates(piece.coords, coords))
        if (index < 0) {
            throw Error(`No piece at ${coords.q},${coords.r}`)
        }
        const [removed] = this.pieces.splice(index, 1)
        return { playerId: removed.playerId, gipf: removed.gipf }
    }
}
