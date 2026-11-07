import { flushSync } from 'svelte'
import { ActionType, StartingSpaceIds, type SpaceId } from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    chipOf,
    NoBoardOffer,
    offerOfPick,
    roleOf,
    spaceTarget,
    strongestChip,
    type BoardViewer,
    type MapPick
} from './boardOffer.js'

const A: SpaceId = 'space.desert.3'
const B: SpaceId = 'space.desert.4'
const ELSEWHERE = spaceTarget('space.desert.1')

const decider: BoardViewer = {
    viewerId: 'p1',
    validActions: [ActionType.PlaceStartingPawn],
    viewingHistory: false,
    updatingVisibleState: false
}
const watcher: BoardViewer = { ...decider, viewerId: 'p2', validActions: [] }

function pick(fields: Partial<MapPick> = {}): MapPick {
    return {
        action: ActionType.PlaceStartingPawn,
        deciderId: 'p1',
        targets: [{ target: spaceTarget(A) }, { target: spaceTarget(B) }],
        picked: [],
        isPublic: true,
        ...fields
    }
}

describe('the roles a pick gives (contract: Coexistence and precedence)', () => {
    it('lit for the seat deciding, and everything it does not name dims', () => {
        const offer = offerOfPick(pick(), decider)
        expect(roleOf(offer, spaceTarget(A))).toBe('lit')
        expect(roleOf(offer, ELSEWHERE)).toBe('dimmed')
    })

    it('picked once pressed', () => {
        const offer = offerOfPick(pick({ picked: [spaceTarget(A)] }), decider)
        expect(roleOf(offer, spaceTarget(A))).toBe('picked')
        expect(roleOf(offer, spaceTarget(B))).toBe('lit')
    })

    it('being decided for anyone else on a public pick, and nothing dims', () => {
        const offer = offerOfPick(pick({ picked: [spaceTarget(A)] }), watcher)
        expect(roleOf(offer, spaceTarget(A))).toBe('being-decided')
        expect(roleOf(offer, ELSEWHERE)).toBe('plain')
    })

    it('a hidden pick shows others nothing', () => {
        expect(offerOfPick(pick({ isPublic: false }), watcher)).toBe(NoBoardOffer)
    })

    it('plain with no pick open', () => {
        expect(roleOf(offerOfPick(undefined, decider), ELSEWHERE)).toBe('plain')
    })

    it('a pick the seat is not offered is no pick for it', () => {
        expect(offerOfPick(pick(), { ...decider, validActions: [] })).toBe(NoBoardOffer)
    })
})

describe('one chip per target (contract: Coexistence and precedence)', () => {
    const cost = { kind: 'cost', label: '-1 food' } as const
    const threat = { kind: 'threat', label: 'attacked' } as const
    const role = { kind: 'role', label: 'master' } as const
    const gain = { kind: 'gain', label: '+1 wood' } as const

    it('rose wins over a role, which wins over a gain', () => {
        expect(strongestChip([gain, role, cost])).toEqual({ ...cost, tone: 'rose' })
        expect(strongestChip([gain, threat, role])).toEqual({ ...threat, tone: 'rose' })
        expect(strongestChip([gain, role])).toEqual({ ...role, tone: 'amber' })
        expect(strongestChip([gain])).toEqual({ ...gain, tone: 'amber' })
        expect(strongestChip([])).toBeUndefined()
    })

    it('the deciding seat sees it; nobody else does', () => {
        const noted = pick({ targets: [{ target: spaceTarget(A), notes: [gain, cost] }] })
        expect(chipOf(offerOfPick(noted, decider), spaceTarget(A))).toEqual({
            ...cost,
            tone: 'rose'
        })
        expect(chipOf(offerOfPick(noted, watcher), spaceTarget(A))).toBeUndefined()
    })
})

describe('what empties the offer (contract: Coexistence and precedence)', () => {
    it('History View gives only the outline: no lit, no chip, no dimming, for the decider too', () => {
        const noted = pick({
            targets: [{ target: spaceTarget(A), notes: [{ kind: 'gain', label: '+1 wood' }] }],
            picked: [spaceTarget(A)]
        })
        for (const viewer of [decider, watcher]) {
            const offer = offerOfPick(noted, { ...viewer, viewingHistory: true })
            expect(roleOf(offer, spaceTarget(A))).toBe('being-decided')
            expect(chipOf(offer, spaceTarget(A))).toBeUndefined()
            expect(offer.dimsRest).toBe(false)
        }
    })

    it('History View shows nothing of a hidden pick', () => {
        const offer = offerOfPick(pick({ isPublic: false }), { ...decider, viewingHistory: true })
        expect(offer).toBe(NoBoardOffer)
    })

    it('updatingVisibleState empties it for everyone, outline included', () => {
        for (const viewer of [decider, watcher]) {
            expect(offerOfPick(pick(), { ...viewer, updatingVisibleState: true })).toBe(
                NoBoardOffer
            )
        }
    })
})

describe('the board offer on the real session', () => {
    let host: FeudumHost | undefined

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })

    afterEach(() => {
        host?.close()
        host = undefined
        vi.restoreAllMocks()
    })

    async function atPawns(): Promise<FeudumHost> {
        host = new FeudumHost()
        await host.playStartingGoods()
        return host
    }

    it('R-1.4.9 S2: the six starting spaces are lit, the map dims, the picked space shows', async () => {
        const table = await atPawns()
        const session = await table.openSeat(table.setupSeat)
        flushSync()

        for (const spaceId of StartingSpaceIds) {
            expect(roleOf(session.boardOffer, spaceTarget(spaceId))).toBe('lit')
        }
        expect(session.boardOffer.targets.size).toBe(6)
        expect(roleOf(session.boardOffer, ELSEWHERE)).toBe('dimmed')

        await session.pressStartingSpace(A)
        flushSync()
        expect(roleOf(session.boardOffer, spaceTarget(A))).toBe('picked')
    })

    it('R-1.4.9 another seat sees the six outlined, and nothing dims', async () => {
        const table = await atPawns()
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)
        flushSync()

        expect(roleOf(session.boardOffer, spaceTarget(A))).toBe('being-decided')
        expect(session.boardOffer.dimsRest).toBe(false)
    })

    it('R-1.4.8 a panel-only step offers nothing on the map', async () => {
        host = new FeudumHost()
        const session = await host.openSeat(host.setupSeat)
        flushSync()
        expect(session.boardOffer).toBe(NoBoardOffer)
    })

    it('R-3.1 hand selection offers nothing on the map', async () => {
        const table = await atPawns()
        await table.playStartingPawns()
        const session = await table.openSeat(table.order[0])
        flushSync()
        expect(session.boardOffer).toBe(NoBoardOffer)
    })
})
