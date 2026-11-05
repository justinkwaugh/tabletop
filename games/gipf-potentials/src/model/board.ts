import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addAxial,
    AxialCoordinates,
    Hydratable,
    sameCoordinates,
    scaleAxial
} from '@tabletop/common'
import { AXES, CENTRE, DIRECTIONS, GEOMETRY, pointKey, type Entry } from './geometry.js'
import { isLoaded, mayStayInRow, PieceKind, Unit, type PotentialKind } from './pieces.js'

export type Spot = Type.Static<typeof Spot>
export const Spot = Type.Object({
    coords: AxialCoordinates,
    stack: Type.Array(Unit)
})

export type GipfPotentialsBoard = Type.Static<typeof GipfPotentialsBoard>
export const GipfPotentialsBoard = Type.Object({
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
const GipfPotentialsBoardValidator = Compile(GipfPotentialsBoard)

export function emptyBoard(): GipfPotentialsBoard {
    return { spots: GEOMETRY.spots.map((coords) => ({ coords: { ...coords }, stack: [] })) }
}

export class HydratedGipfPotentialsBoard
    extends Hydratable<typeof GipfPotentialsBoard>
    implements GipfPotentialsBoard
{
    declare spots: Spot[]

    constructor(data: GipfPotentialsBoard) {
        super(data, GipfPotentialsBoardValidator)
    }

    private spotAt(coords: AxialCoordinates): Spot | undefined {
        const key = pointKey(coords)
        return this.spots.find((spot) => pointKey(spot.coords) === key)
    }

    private requireSpot(coords: AxialCoordinates): Spot {
        const spot = this.spotAt(coords)
        if (spot === undefined) {
            throw Error(`No spot at ${coords.q},${coords.r}`)
        }
        return spot
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

    place(coords: AxialCoordinates, unit: Unit) {
        this.requireSpot(coords).stack.push(structuredClone(unit))
    }

    tops(): PlacedUnit[] {
        return this.spots.flatMap((spot) => {
            const unit = spot.stack[spot.stack.length - 1]
            return unit === undefined ? [] : [{ coords: spot.coords, unit }]
        })
    }

    // PÜNCT, rule 5: a covered GIPF-piece does not count while something lies on it.
    gipfPiecesOf(playerId: string): number {
        return this.tops().filter(
            ({ unit }) => unit.kind === PieceKind.Gipf && unit.playerId === playerId
        ).length
    }

    findEntry(dot: AxialCoordinates, firstSpot: AxialCoordinates): Entry | undefined {
        return GEOMETRY.entries.find(
            (entry) => sameCoordinates(entry.dot, dot) && sameCoordinates(entry.line[0], firstSpot)
        )
    }

    // A push needs room: some spot on its line must be empty, or a piece would leave the board.
    canPush(entry: Entry): boolean {
        return entry.line.some((coords) => this.isEmpty(coords))
    }

    legalEntries(): Entry[] {
        return GEOMETRY.entries.filter((entry) => this.canPush(entry))
    }

    // How many stacks the push moves on: those before the first empty spot.
    shiftedBy(entry: Entry): number {
        return entry.line.findIndex((coords) => this.isEmpty(coords))
    }

    // Pushes the unit onto the line's first spot and returns the top of a stack it moves onto the
    // centre.
    push(entry: Entry, unit: Unit): Unit | undefined {
        const gap = this.shiftedBy(entry)
        if (gap < 0) {
            throw Error('The line is full')
        }
        for (let index = gap; index > 0; index--) {
            this.requireSpot(entry.line[index]).stack = this.requireSpot(
                entry.line[index - 1]
            ).stack
        }
        this.requireSpot(entry.line[0]).stack = [structuredClone(unit)]
        const centre = entry.line.findIndex((coords) => sameCoordinates(coords, CENTRE))
        return centre >= 0 && centre <= gap ? this.topAt(CENTRE) : undefined
    }

    // Where the potential of a loaded piece could go, by its kind. A PÜNCT-potential covers an
    // opponent's GIPF-piece only with a piece from the reserve to put on it.
    potentialTargets(from: AxialCoordinates, reserve: number): AxialCoordinates[] {
        const unit = this.topAt(from)
        if (unit?.load === undefined) {
            return []
        }
        return DIRECTIONS.flatMap((direction) => {
            const line = GEOMETRY.lineFrom(addAxial(from, direction), direction)
            return this.landings(unit.load, unit.playerId, line, reserve)
        })
    }

    private landings(
        kind: PotentialKind | undefined,
        playerId: string,
        line: AxialCoordinates[],
        reserve: number
    ): AxialCoordinates[] {
        const firstOccupied = line.findIndex((coords) => !this.isEmpty(coords))
        const neighbour = firstOccupied === 0 ? this.topAt(line[0]) : undefined
        const opponents = neighbour !== undefined && neighbour.playerId !== playerId
        switch (kind) {
            case PieceKind.Yinsh:
                return firstOccupied < 0 ? line : line.slice(0, firstOccupied)
            case PieceKind.Zertz: {
                const landing = line.find((coords) => this.isEmpty(coords))
                return neighbour !== undefined && landing !== undefined ? [landing] : []
            }
            case PieceKind.Dvonn:
                return opponents && this.dvonnMayCover(neighbour) ? [line[0]] : []
            case PieceKind.Punct:
                return opponents && this.punctMayCover(neighbour, reserve) ? [line[0]] : []
            default:
                return []
        }
    }

    // DVONN, rule 1: an opponent's basic piece, plain or DVONN-loaded, or their used DVONN.
    private dvonnMayCover(unit: Unit): boolean {
        return (
            (unit.kind === PieceKind.Basic &&
                (unit.load === undefined || unit.load === PieceKind.Dvonn)) ||
            unit.kind === PieceKind.Dvonn
        )
    }

    // PÜNCT, rule 2: an opponent's PÜNCT-loaded piece, their used PÜNCT, or their GIPF-piece.
    private punctMayCover(unit: Unit, reserve: number): boolean {
        return (
            unit.load === PieceKind.Punct ||
            unit.kind === PieceKind.Punct ||
            (unit.kind === PieceKind.Gipf && reserve > 0)
        )
    }

    // The potential leaves its basic piece as a used potential of its own.
    unload(coords: AxialCoordinates): Unit {
        const unit = this.topAt(coords)
        if (unit?.load === undefined) {
            throw Error('No loaded piece to unload')
        }
        const [basicId, potentialId] = unit.discIds
        const potential: Unit = {
            playerId: unit.playerId,
            kind: unit.load,
            discIds: potentialId === undefined ? [] : [potentialId]
        }
        delete unit.load
        unit.discIds = [basicId]
        return potential
    }

    rows(): Row[] {
        const rows: Row[] = []
        for (const axis of AXES) {
            const starts = GEOMETRY.spots.filter(
                (coords) => !GEOMETRY.isSpot(addAxial(coords, scaleAxial(axis, -1)))
            )
            for (const start of starts) {
                let run: AxialCoordinates[] = []
                let runOwner: string | undefined
                const close = () => {
                    if (runOwner !== undefined && run.length >= ROW_LENGTH) {
                        rows.push(this.rowFrom(runOwner, run, axis))
                    }
                }
                for (const coords of GEOMETRY.lineFrom(start, axis)) {
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
            while (GEOMETRY.isSpot(current) && !this.isEmpty(current)) {
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

    // General use, rule 8: only a row of GIPF-pieces alone may stay; a loaded piece in the four
    // means it must be broken, and a piece that may not stay means it must be taken.
    isMandatory(row: Row): boolean {
        return (
            row.reach.some((coords) => !this.mayStay(coords)) ||
            row.run.some((coords) => isLoaded(this.topAt(coords)))
        )
    }

    mayStay(coords: AxialCoordinates): boolean {
        const top = this.topAt(coords)
        return top !== undefined && mayStayInRow(top)
    }

    removeTop(coords: AxialCoordinates): Unit {
        const unit = this.requireSpot(coords).stack.pop()
        if (unit === undefined) {
            throw Error(`No piece at ${coords.q},${coords.r}`)
        }
        return unit
    }
}
