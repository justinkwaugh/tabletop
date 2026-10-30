import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addAxial,
    AxialCoordinates,
    Hydratable,
    sameCoordinates,
    scaleAxial
} from '@tabletop/common'
import {
    AXES,
    BoardShape,
    CENTRE,
    DIRECTIONS,
    GEOMETRIES,
    pointKey,
    type BoardGeometry,
    type Entry
} from './geometry.js'

export enum PieceKind {
    Gipf = 'gipf',
    Tamsk = 'tamsk',
    Zertz = 'zertz',
    Dvonn = 'dvonn',
    Yinsh = 'yinsh',
    Punct = 'punct'
}

export type PotentialKind = Exclude<PieceKind, PieceKind.Gipf>
export const POTENTIAL_KINDS: readonly PotentialKind[] = [
    PieceKind.Tamsk,
    PieceKind.Zertz,
    PieceKind.Dvonn,
    PieceKind.Yinsh,
    PieceKind.Punct
]

export function isPotentialKind(kind: PieceKind): kind is PotentialKind {
    return kind !== PieceKind.Gipf
}

// What sits on a spot, bottom to top. A paired unit is an unused stack of two potentials of one
// kind and colour; every other unit is a single piece. Only the top unit is in play.
export type Unit = Type.Static<typeof Unit>
export const Unit = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(PieceKind),
    paired: Type.Boolean()
})

export type Spot = Type.Static<typeof Spot>
export const Spot = Type.Object({
    coords: AxialCoordinates,
    stack: Type.Array(Unit)
})

export type MatrxBoard = Type.Static<typeof MatrxBoard>
export const MatrxBoard = Type.Object({
    shape: Type.Enum(BoardShape),
    spots: Type.Array(Spot)
})

// A row is four or more adjacent spots topped by one player's pieces in a line. Its reach runs on
// in both directions while spots are occupied.
export type Row = {
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
    run: AxialCoordinates[]
    reach: AxialCoordinates[]
}

export type PlacedUnit = { coords: AxialCoordinates; unit: Unit }

export const ROW_LENGTH = 4
const MatrxBoardValidator = Compile(MatrxBoard)

export function emptyBoard(shape: BoardShape): MatrxBoard {
    return {
        shape,
        spots: GEOMETRIES[shape].spots.map((coords) => ({ coords: { ...coords }, stack: [] }))
    }
}

export class HydratedMatrxBoard extends Hydratable<typeof MatrxBoard> implements MatrxBoard {
    declare shape: BoardShape
    declare spots: Spot[]

    constructor(data: MatrxBoard) {
        super(data, MatrxBoardValidator)
    }

    get geometry(): BoardGeometry {
        return GEOMETRIES[this.shape]
    }

    private spotAt(coords: AxialCoordinates): Spot | undefined {
        const key = pointKey(coords)
        return this.spots.find((spot) => pointKey(spot.coords) === key)
    }

    stackAt(coords: AxialCoordinates): Unit[] {
        return this.spotAt(coords)?.stack ?? []
    }

    topAt(coords: AxialCoordinates): Unit | undefined {
        const stack = this.stackAt(coords)
        return stack[stack.length - 1]
    }

    isEmpty(coords: AxialCoordinates): boolean {
        return this.stackAt(coords).length === 0
    }

    private requireSpot(coords: AxialCoordinates): Spot {
        const spot = this.spotAt(coords)
        if (spot === undefined) {
            throw Error(`No spot at ${coords.q},${coords.r}`)
        }
        return spot
    }

    place(coords: AxialCoordinates, unit: Unit) {
        this.requireSpot(coords).stack.push({ ...unit })
    }

    tops(): PlacedUnit[] {
        return this.spots.flatMap((spot) => {
            const unit = spot.stack[spot.stack.length - 1]
            return unit === undefined ? [] : [{ coords: spot.coords, unit }]
        })
    }

    gipfPiecesOf(playerId: string): number {
        return this.spots
            .flatMap((spot) => spot.stack)
            .filter((unit) => unit.kind === PieceKind.Gipf && unit.playerId === playerId).length
    }

    findEntry(dot: AxialCoordinates, firstSpot: AxialCoordinates): Entry | undefined {
        return this.geometry.entries.find(
            (entry) => sameCoordinates(entry.dot, dot) && sameCoordinates(entry.line[0], firstSpot)
        )
    }

    // A push needs room: some spot on its line must be empty, or a piece would leave the board.
    canPush(entry: Entry): boolean {
        return entry.line.some((coords) => this.isEmpty(coords))
    }

    legalEntries(): Entry[] {
        return this.geometry.entries.filter((entry) => this.canPush(entry))
    }

    // How many stacks the push moves on: those before the first empty spot.
    shiftedBy(entry: Entry): number {
        return entry.line.findIndex((coords) => this.isEmpty(coords))
    }

    // Pushes the unit onto the line's first spot and returns the stack that lands on the centre.
    push(entry: Entry, unit: Unit): Unit[] | undefined {
        const gap = this.shiftedBy(entry)
        if (gap < 0) {
            throw Error('The line is full')
        }
        for (let index = gap; index > 0; index--) {
            this.requireSpot(entry.line[index]).stack = this.requireSpot(
                entry.line[index - 1]
            ).stack
        }
        this.requireSpot(entry.line[0]).stack = [{ ...unit }]
        const centre = entry.line.findIndex((coords) => sameCoordinates(coords, CENTRE))
        return centre >= 0 && centre <= gap ? this.stackAt(CENTRE) : undefined
    }

    // Where the top piece of a paired potential could move, by its kind.
    potentialTargets(from: AxialCoordinates): AxialCoordinates[] {
        const unit = this.topAt(from)
        if (unit === undefined || !unit.paired) {
            return []
        }
        return DIRECTIONS.flatMap((direction) => this.landings(unit, from, direction))
    }

    private landings(
        unit: Unit,
        from: AxialCoordinates,
        direction: AxialCoordinates
    ): AxialCoordinates[] {
        const line = this.geometry.lineFrom(addAxial(from, direction), direction)
        const firstOccupied = line.findIndex((coords) => !this.isEmpty(coords))
        switch (unit.kind) {
            case PieceKind.Yinsh:
                return firstOccupied < 0 ? line : line.slice(0, firstOccupied)
            case PieceKind.Zertz: {
                const landing = line.find((coords) => this.isEmpty(coords))
                return firstOccupied === 0 && landing !== undefined ? [landing] : []
            }
            case PieceKind.Dvonn:
            case PieceKind.Punct: {
                const target = line[firstOccupied]
                const top = target === undefined ? undefined : this.topAt(target)
                return top?.kind === unit.kind && top.playerId !== unit.playerId ? [target] : []
            }
            default:
                return []
        }
    }

    // The top piece of a paired potential lands as a single, leaving its partner as one.
    movePotential(from: AxialCoordinates, to: AxialCoordinates): Unit {
        const moved = this.takeTopOfPair(from)
        this.place(to, moved)
        return moved
    }

    takeTopOfPair(coords: AxialCoordinates): Unit {
        const unit = this.topAt(coords)
        if (unit === undefined || !unit.paired) {
            throw Error('No pair to split')
        }
        unit.paired = false
        return { playerId: unit.playerId, kind: unit.kind, paired: false }
    }

    rows(): Row[] {
        const rows: Row[] = []
        const { geometry } = this
        for (const axis of AXES) {
            const starts = geometry.spots.filter(
                (coords) => !geometry.isSpot(addAxial(coords, scaleAxial(axis, -1)))
            )
            for (const start of starts) {
                let run: AxialCoordinates[] = []
                let runOwner: string | undefined
                const close = () => {
                    if (runOwner !== undefined && run.length >= ROW_LENGTH) {
                        rows.push(this.rowFrom(runOwner, run, axis))
                    }
                }
                for (const coords of geometry.lineFrom(start, axis)) {
                    const owner = this.topAt(coords)?.playerId
                    if (owner !== undefined && owner === runOwner) {
                        run.push(coords)
                    } else {
                        close()
                        run = owner === undefined ? [] : [coords]
                        runOwner = owner
                    }
                }
                close()
            }
        }
        return rows
    }

    private rowFrom(playerId: string, run: AxialCoordinates[], axis: AxialCoordinates): Row {
        const reach = [...run]
        const extend = (
            from: AxialCoordinates,
            step: AxialCoordinates,
            add: (c: AxialCoordinates) => void
        ) => {
            let current = addAxial(from, step)
            while (this.geometry.isSpot(current) && !this.isEmpty(current)) {
                add(current)
                current = addAxial(current, step)
            }
        }
        extend(run[0], scaleAxial(axis, -1), (coords) => reach.unshift(coords))
        extend(run[run.length - 1], axis, (coords) => reach.push(coords))
        return { playerId, from: run[0], to: run[run.length - 1], run, reach }
    }

    rowsOf(playerId: string): Row[] {
        return this.rows().filter((row) => row.playerId === playerId)
    }

    findRow(playerId: string, from: AxialCoordinates, to: AxialCoordinates): Row | undefined {
        return this.rowsOf(playerId).find(
            (row) =>
                (sameCoordinates(row.from, from) && sameCoordinates(row.to, to)) ||
                (sameCoordinates(row.from, to) && sameCoordinates(row.to, from))
        )
    }

    removeTop(coords: AxialCoordinates): Unit {
        const unit = this.requireSpot(coords).stack.pop()
        if (unit === undefined) {
            throw Error(`No piece at ${coords.q},${coords.r}`)
        }
        return unit
    }
}
