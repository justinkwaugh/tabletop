import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    addAxial,
    AxialCoordinates,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    Hydratable,
    sameCoordinates,
    scaleAxial
} from '@tabletop/common'
import { MarbleColor } from './marbles.js'

export type Ring = Type.Static<typeof Ring>
export const Ring = Type.Object({
    coords: AxialCoordinates,
    marble: Type.Optional(Type.Enum(MarbleColor)),
    // What the marble's specks are drawn from; it goes wherever the marble goes. None on a marble
    // placed before the state kept it.
    marbleSeed: Type.Optional(Type.Number())
})

// Seeded by ring and action number, so two marbles placed on one ring at different times differ.
export function placementSeed(coords: AxialCoordinates, actionIndex: number): number {
    return coordinatesToNumber(coords) + 7919 * (actionIndex + 1)
}

export type Jump = {
    from: AxialCoordinates
    over: AxialCoordinates
    to: AxialCoordinates
}

export type JumpResult = {
    jumper: MarbleColor
    captured: MarbleColor
    jumperSeed?: number
    capturedSeed?: number
}

export type ZertzBoard = Type.Static<typeof ZertzBoard>
export const ZertzBoard = Type.Object({
    rings: Type.Array(Ring)
})

const ZertzBoardValidator = Compile(ZertzBoard)

const CLOCKWISE_OFFSETS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

export class HydratedZertzBoard extends Hydratable<typeof ZertzBoard> implements ZertzBoard {
    declare rings: Ring[]

    constructor(data: ZertzBoard) {
        super(data, ZertzBoardValidator)
    }

    ringAt(coords: AxialCoordinates): Ring | undefined {
        return this.rings.find((ring) => sameCoordinates(ring.coords, coords))
    }

    hasRing(coords: AxialCoordinates): boolean {
        return this.ringAt(coords) !== undefined
    }

    isVacant(coords: AxialCoordinates): boolean {
        const ring = this.ringAt(coords)
        return ring !== undefined && ring.marble === undefined
    }

    vacantRings(): Ring[] {
        return this.rings.filter((ring) => ring.marble === undefined)
    }

    hasVacantRing(): boolean {
        return this.rings.some((ring) => ring.marble === undefined)
    }

    // Rulebook section B: a free ring is vacant and can be slid out without disturbing
    // the others, which needs two adjacent open sides.
    isFree(coords: AxialCoordinates): boolean {
        if (!this.isVacant(coords)) {
            return false
        }
        const openSides = CLOCKWISE_OFFSETS.map((offset) => !this.hasRing(addAxial(coords, offset)))
        return openSides.some((open, index) => open && openSides[(index + 1) % openSides.length])
    }

    freeRings(): Ring[] {
        return this.rings.filter((ring) => this.isFree(ring.coords))
    }

    jumpsFrom(from: AxialCoordinates): Jump[] {
        const ring = this.ringAt(from)
        if (ring?.marble === undefined) {
            return []
        }
        return CLOCKWISE_OFFSETS.map((offset) => ({
            from,
            over: addAxial(from, offset),
            to: addAxial(from, scaleAxial(offset, 2))
        })).filter((jump) => this.ringAt(jump.over)?.marble !== undefined && this.isVacant(jump.to))
    }

    allJumps(): Jump[] {
        return this.rings.flatMap((ring) => this.jumpsFrom(ring.coords))
    }

    hasAnyJump(): boolean {
        return this.rings.some((ring) => this.jumpsFrom(ring.coords).length > 0)
    }

    placeMarble(coords: AxialCoordinates, color: MarbleColor, seed: number) {
        const ring = this.ringAt(coords)
        if (ring === undefined || ring.marble !== undefined) {
            throw Error(`Cannot place a marble at ${coords.q},${coords.r}`)
        }
        ring.marble = color
        ring.marbleSeed = seed
    }

    removeRing(coords: AxialCoordinates) {
        const index = this.rings.findIndex((ring) => sameCoordinates(ring.coords, coords))
        if (index < 0) {
            throw Error(`No ring at ${coords.q},${coords.r}`)
        }
        this.rings.splice(index, 1)
    }

    jump(jump: Jump): JumpResult {
        const from = this.ringAt(jump.from)
        const over = this.ringAt(jump.over)
        const to = this.ringAt(jump.to)
        if (
            from?.marble === undefined ||
            over?.marble === undefined ||
            to === undefined ||
            to.marble !== undefined
        ) {
            throw Error('Invalid jump')
        }
        const result: JumpResult = {
            jumper: from.marble,
            captured: over.marble,
            ...(from.marbleSeed === undefined ? {} : { jumperSeed: from.marbleSeed }),
            ...(over.marbleSeed === undefined ? {} : { capturedSeed: over.marbleSeed })
        }
        to.marble = from.marble
        if (from.marbleSeed !== undefined) to.marbleSeed = from.marbleSeed
        for (const left of [from, over]) {
            delete left.marble
            delete left.marbleSeed
        }
        return result
    }

    groups(): Ring[][] {
        const ringsByKey = new Map(
            this.rings.map((ring) => [coordinatesToNumber(ring.coords), ring])
        )
        const visited = new Set<number>()
        const groups: Ring[][] = []
        for (const start of this.rings) {
            const startKey = coordinatesToNumber(start.coords)
            if (visited.has(startKey)) {
                continue
            }
            visited.add(startKey)
            const group: Ring[] = []
            const frontier = [start]
            for (let ring = frontier.pop(); ring !== undefined; ring = frontier.pop()) {
                group.push(ring)
                for (const offset of CLOCKWISE_OFFSETS) {
                    const key = coordinatesToNumber(addAxial(ring.coords, offset))
                    const neighbor = ringsByKey.get(key)
                    if (neighbor !== undefined && !visited.has(key)) {
                        visited.add(key)
                        frontier.push(neighbor)
                    }
                }
            }
            groups.push(group)
        }
        return groups
    }

    // Rulebook section D: a cut-off group with no vacant ring is claimed by the mover.
    claimFullGroups(): Ring[] {
        const claimed = this.groups()
            .filter((group) => group.every((ring) => ring.marble !== undefined))
            .flat()
        for (const ring of claimed) {
            this.removeRing(ring.coords)
        }
        return claimed
    }
}
