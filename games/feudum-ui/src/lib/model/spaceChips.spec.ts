import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedFeudumGameState, MonsterIds, Spaces, type SpaceId } from '@tabletop/feudum'
import { addPawn, atPlayingCards, type TurnTable } from '$lib/testing/turnTable.js'
import { SpaceRingFrame, spaceGeometry } from '$lib/utils/boardGeometry.js'
import {
    pawnTarget,
    spaceTarget,
    type BoardChip,
    type BoardOffer,
    type BoardTarget,
    type BoardTargetOffer
} from './boardOffer.js'
import {
    ChipHeight,
    PieceFrame,
    chipLayout,
    chipRow,
    spaceChips,
    type PlacedChip
} from './spaceChips.js'

/** Contract, Pick conventions: Migrate's chips, "off" on a pawn and the food on a space. */
const Off: BoardChip = { kind: 'role', label: 'off', tone: 'amber' }
const Food: BoardChip = {
    kind: 'cost',
    label: '1 food',
    tone: 'rose',
    art: [{ kind: 'good', good: 'food', count: 1 }]
}

let table: TurnTable
let spaceId: SpaceId

/** A space with nothing on it yet, so each spec reads only what it puts there. */
function bareSpace(state: HydratedFeudumGameState): SpaceId {
    const bare = Spaces.find(({ id }) => {
        const space = state.spaces[id]
        const pawnHere = state.players.some(({ pawns }) =>
            pawns.some((pawn) => pawn.spaceId === id)
        )
        return !space.ruler && !space.serf && !space.landscape && !pawnHere
    })
    if (!bare) {
        throw new Error('Every space is taken')
    }
    return bare.id
}

/** The seat's first `count` pawns, all on one bare space, and no monster anywhere. */
function pawnsSharing(count: number): HydratedFeudumGameState {
    const { host, seat } = table
    host.edit((state) => {
        for (const monster of MonsterIds) {
            delete state.monsters[monster].spaceId
        }
        spaceId = bareSpace(state)
        const [first] = state.getPlayerState(seat).pawns
        first.spaceId = spaceId
        for (let more = 1; more < count; more += 1) {
            addPawn(state, seat, 'merchant', spaceId)
        }
    })
    return new HydratedFeudumGameState(structuredClone(host.state))
}

function offerOf(...chips: readonly (readonly [BoardTarget, BoardChip])[]): BoardOffer {
    const targets = new Map<BoardTarget, BoardTargetOffer>(
        chips.map(([target, chip]) => [target, { role: 'lit', chip }])
    )
    return { targets, dimsRest: true }
}

function pawnsOf(state: HydratedFeudumGameState): readonly BoardTarget[] {
    return state
        .getPlayerState(table.seat)
        .pawns.filter((pawn) => pawn.spaceId === spaceId)
        .map((pawn) => pawnTarget(table.seat, pawn.n))
}

/** No two chips' boxes meet. */
function expectClear(placed: readonly PlacedChip[]) {
    const boxes = placed.map(({ chip, at }) => {
        const half = chipLayout(chip).width / 2
        return { left: at.x - half, right: at.x + half, top: at.y - ChipHeight / 2 }
    })
    for (const [index, box] of boxes.entries()) {
        for (const other of boxes.slice(index + 1)) {
            const meets =
                box.left < other.right &&
                other.left < box.right &&
                Math.abs(box.top - other.top) < ChipHeight
            expect(meets, `${JSON.stringify(box)} meets ${JSON.stringify(other)}`).toBe(false)
        }
    }
}

beforeEach(async () => {
    table = await atPlayingCards(['migrate'])
})

describe('a row of chips', () => {
    it('leaves a lone chip where it wants to stand', () => {
        expect(chipRow([{ x: 40, width: 60 }])).toEqual([40])
    })

    it('parts two chips evenly about where they want to stand, in their order', () => {
        const [left = 0, right = 0] = chipRow([
            { x: -19, width: 60 },
            { x: -56, width: 60 }
        ])
        expect(right).toBeLessThan(left)
        expect(left - right).toBeGreaterThanOrEqual(60)
        expect((left + right) / 2).toBeCloseTo((-19 - 56) / 2)
    })

    it('parts three chips of different widths, none over the next', () => {
        const wanted = [
            { x: -56, width: 60 },
            { x: -19, width: 88 },
            { x: 19, width: 60 }
        ]
        const [a = 0, b = 0, c = 0] = chipRow(wanted)
        expect(b - a).toBeGreaterThanOrEqual((60 + 88) / 2)
        expect(c - b).toBeGreaterThanOrEqual((88 + 60) / 2)
    })
})

describe('R-3.6 the chips on a space its pawns share', () => {
    it('two pawns that may go off and the space they may come onto: three chips, none over another', () => {
        const state = pawnsSharing(2)
        const pawns = pawnsOf(state)
        expect(pawns).toHaveLength(2)
        const offer = offerOf(...pawns.map((pawn) => [pawn, Off] as const), [
            spaceTarget(spaceId),
            Food
        ])
        const placed = spaceChips(state, offer, spaceId)
        expect(placed.map(({ target }) => target).sort()).toEqual(
            [...pawns, spaceTarget(spaceId)].sort()
        )
        expectClear(placed)
    })

    it('three pawns that may go off: three chips in one row over the pawns, each over its own', () => {
        const state = pawnsSharing(3)
        const pawns = pawnsOf(state)
        expect(pawns).toHaveLength(3)
        const placed = spaceChips(
            state,
            offerOf(...pawns.map((pawn) => [pawn, Off] as const)),
            spaceId
        )
        expect(placed).toHaveLength(3)
        expectClear(placed)
        const slots = spaceGeometry(spaceId).pieceSlots
        const piecesTop = Math.min(...slots.slice(0, 3).map(({ y }) => y - PieceFrame / 2))
        for (const [slot, { at, chip, target }] of placed.entries()) {
            // In slot order, each still over its own pawn, all above the pawns.
            expect(target).toBe(pawns[slot])
            expect(Math.abs(at.x - slots[slot].x)).toBeLessThan(chipLayout(chip).width / 2)
            expect(at.y + ChipHeight / 2).toBeLessThanOrEqual(piecesTop)
            expect(at.y).toBe(placed[0].at.y)
        }
    })

    it('a lone pawn chip stands over its pawn, and a lone space chip over its disc, as ever', () => {
        const state = pawnsSharing(1)
        const [pawn] = pawnsOf(state)
        const slot = spaceGeometry(spaceId).pieceSlots[0]
        expect(spaceChips(state, offerOf([pawn, Off]), spaceId)).toEqual([
            { target: pawn, chip: Off, at: { x: slot.x, y: slot.y - PieceFrame / 2 - 24 } }
        ])
        const centre = spaceGeometry(spaceId).centre
        expect(spaceChips(state, offerOf([spaceTarget(spaceId), Food]), spaceId)).toEqual([
            {
                target: spaceTarget(spaceId),
                chip: Food,
                at: { x: centre.x, y: centre.y - SpaceRingFrame / 2 - 24 }
            }
        ])
    })

    it("R-3.7.1 a space's chip stands over the pawns there that take a press, though they carry no chip", () => {
        // A Move's step back onto the space where the other pawn, still to move, waits.
        const state = pawnsSharing(2)
        const pawns = pawnsOf(state)
        const targets = new Map<BoardTarget, BoardTargetOffer>([
            ...pawns.map((pawn) => [pawn, { role: 'lit' }] as const),
            [spaceTarget(spaceId), { role: 'lit', chip: Off }]
        ])
        const [placed] = spaceChips(state, { targets, dimsRest: true }, spaceId)
        const slots = spaceGeometry(spaceId).pieceSlots.slice(0, 2)
        const piecesTop = Math.min(...slots.map(({ y }) => y - PieceFrame / 2))
        expect(placed.target).toBe(spaceTarget(spaceId))
        expect(placed.at.y + ChipHeight / 2).toBeLessThanOrEqual(piecesTop)
    })

    it('R-4.1 past four pieces, the row stands clear of the count', () => {
        const state = pawnsSharing(3)
        const pawns = pawnsOf(state)
        table.host.edit((edited) => {
            const others = edited.players.filter(({ playerId }) => playerId !== table.seat)
            for (const { playerId } of others) {
                addPawn(edited, playerId, 'knight', spaceId)
            }
        })
        const crowded = new HydratedFeudumGameState(structuredClone(table.host.state))
        const placed = spaceChips(
            crowded,
            offerOf(...pawns.map((pawn) => [pawn, Off] as const)),
            spaceId
        )
        expect(placed).toHaveLength(3)
        const count = spaceGeometry(spaceId).countChip
        for (const { at } of placed) {
            expect(at.y + ChipHeight / 2).toBeLessThan(count.y - 10)
        }
    })
})
