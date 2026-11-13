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
import { AXES, CENTRE, DIRECTIONS, GEOMETRIES, type BoardGeometry, type Entry } from './geometry.js'
import { BoardShape } from './boardShape.js'

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

// A single piece, or an unused stack of two potentials: one disc id or two, bottom first.
export type Unit = Type.Static<typeof Unit>
export const Unit = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(PieceKind),
    discIds: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1, maxItems: 2 })
})

// Bottom to top; only the top unit is in play.
export type Stack = Type.Static<typeof Stack>
export const Stack = Type.Object({
    coords: AxialCoordinates,
    units: Type.Array(Unit, { minItems: 1 })
})

export type MatrxBoard = Type.Static<typeof MatrxBoard>
export const MatrxBoard = Type.Object({
    shape: Type.Enum(BoardShape),
    stacks: Type.Array(Stack)
})

// A row's reach runs on in both directions while spots are occupied.
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
    return { shape, stacks: [] }
}

// Rules G1 and G6: potentials come in, and go back to the reserve, in stacks of two.
export const PAIR_SIZE = 2

export function isPair(unit: Pick<Unit, 'discIds'>): boolean {
    return unit.discIds.length === PAIR_SIZE
}

// Rule F1: a GIPF piece comes in as a single piece.
export function discsBroughtIn(kind: PieceKind): number {
    return isPotentialKind(kind) ? PAIR_SIZE : 1
}

export class HydratedMatrxBoard extends Hydratable<typeof MatrxBoard> implements MatrxBoard {
    declare shape: BoardShape
    declare stacks: Stack[]

    constructor(data: MatrxBoard) {
        super(data, MatrxBoardValidator)
    }

    get geometry(): BoardGeometry {
        return GEOMETRIES[this.shape]
    }

    private stackOf(coords: AxialCoordinates): Stack | undefined {
        return this.stacks.find((stack) => sameCoordinates(stack.coords, coords))
    }

    stackAt(coords: AxialCoordinates): Unit[] {
        return this.stackOf(coords)?.units ?? []
    }

    topAt(coords: AxialCoordinates): Unit | undefined {
        const stack = this.stackAt(coords)
        return stack[stack.length - 1]
    }

    isEmpty(coords: AxialCoordinates): boolean {
        return this.stackAt(coords).length === 0
    }

    place(coords: AxialCoordinates, unit: Unit) {
        if (!this.geometry.isSpot(coords)) {
            throw Error(`No spot at ${coords.q},${coords.r}`)
        }
        const placed = { ...unit, discIds: [...unit.discIds] }
        const stack = this.stackOf(coords)
        if (stack === undefined) {
            this.stacks.push({ coords: { ...coords }, units: [placed] })
        } else {
            stack.units.push(placed)
        }
    }

    tops(): PlacedUnit[] {
        return this.stacks.map((stack) => ({
            coords: stack.coords,
            unit: stack.units[stack.units.length - 1]
        }))
    }

    gipfPiecesOf(playerId: string): number {
        return this.stacks
            .flatMap((stack) => stack.units)
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

    shiftedBy(entry: Entry): number {
        return entry.line.findIndex((coords) => this.isEmpty(coords))
    }

    push(entry: Entry, unit: Unit): Unit[] | undefined {
        const gap = this.shiftedBy(entry)
        if (gap < 0) {
            throw Error('The line is full')
        }
        for (let index = gap; index > 0; index--) {
            const moving = this.stackOf(entry.line[index - 1])
            assertExists(moving, 'Every spot before the gap holds a stack')
            moving.coords = { ...entry.line[index] }
        }
        this.place(entry.line[0], unit)
        const centre = entry.line.findIndex((coords) => sameCoordinates(coords, CENTRE))
        return centre >= 0 && centre <= gap ? this.stackAt(CENTRE) : undefined
    }

    potentialTargets(from: AxialCoordinates): AxialCoordinates[] {
        const unit = this.topAt(from)
        if (unit === undefined || !isPair(unit)) {
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

    // Rule G3: both potentials of a split pair are used singles.
    movePotential(from: AxialCoordinates, to: AxialCoordinates): Unit {
        const moved = this.takeTopOfPair(from)
        this.place(to, moved)
        return moved
    }

    takeTopOfPair(coords: AxialCoordinates): Unit {
        const unit = this.topAt(coords)
        if (unit === undefined || !isPair(unit)) {
            throw Error('No pair to split')
        }
        const [bottom, top] = unit.discIds
        assertExists(top, 'A pair has two discs')
        unit.discIds = [bottom]
        return { playerId: unit.playerId, kind: unit.kind, discIds: [top] }
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

    // Rule E1: stacks of two in a row's reach may stay, but the row of four must be broken.
    pairsIn(row: Row): AxialCoordinates[] {
        return row.reach.filter((coords) => {
            const top = this.topAt(coords)
            return top !== undefined && isPair(top)
        })
    }

    isValidRemoval(row: Row, keep: readonly AxialCoordinates[]): boolean {
        const pairs = this.pairsIn(row)
        const kept = (coords: AxialCoordinates) => keep.some((k) => sameCoordinates(k, coords))
        return (
            keep.every((coords) => pairs.some((pair) => sameCoordinates(pair, coords))) &&
            row.run.some((coords) => !kept(coords))
        )
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
        const stack = this.stackOf(coords)
        const unit = stack?.units.pop()
        if (stack === undefined || unit === undefined) {
            throw Error(`No piece at ${coords.q},${coords.r}`)
        }
        if (stack.units.length === 0) {
            this.stacks.splice(this.stacks.indexOf(stack), 1)
        }
        return unit
    }
}
