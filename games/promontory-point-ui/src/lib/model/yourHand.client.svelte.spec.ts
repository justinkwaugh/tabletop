import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    HydratedPromontoryPointGameState,
    openSpaceIds,
    type PromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled
} from '$lib/testing/sessionHarness.js'
import {
    canonical,
    seatOf,
    variantConfig,
    withTurnPieces
} from '@tabletop/promontory-point/testing'
import { turnPanel } from './turnPanel.js'
import { HandSlotKind, yourHand, type HandSlot } from './yourHand.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
})

const hydrated = (state: PromontoryPointGameState) => new HydratedPromontoryPointGameState(state)

const piece = (railroadId: RailroadId, tag: string, more: Partial<HandSlot> = {}): HandSlot =>
    ({
        kind: HandSlotKind.Piece,
        railroadId,
        tag,
        pickable: false,
        picked: false,
        noRoom: false,
        kept: false,
        ...more
    }) as HandSlot

describe('your hand (contract, "Your hand")', () => {
    it('O-2: in the viewer’s turn it is the turn panel’s pieces, pressed to pick, not dimmed', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) => withTurnPieces(state, [SP, UP, KP]))
        )
        const viewer = session.myPlayer?.id
        const hand = yourHand(turnPanel(session), session.gameState, viewer)
        assertExists(hand, 'The seat on screen has a hand')
        expect(hand.dimmed).toBe(false)
        expect(hand.heading).toBe('Your pieces · tap one')
        expect(hand.slots).toEqual([
            piece(SP, 'SP', { pickable: true }),
            piece(UP, 'UP', { pickable: true }),
            piece(KP, 'KP', { pickable: true })
        ])

        session.pressPiece(UP)
        const picked = yourHand(turnPanel(session), session.gameState, viewer)
        expect(picked?.slots[1]).toMatchObject({ railroadId: UP, picked: true })
        expect(picked?.heading).toBe('Your pieces')
    })

    it('R-2.2 step 3: a placed piece leaves an empty slot ahead of the pieces still to place', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) => withTurnPieces(state, [CP, UP, KP]))
        )
        session.pressPiece(CP)
        const spaceId = openSpaceIds(session.gameState.track, CP).find(
            (candidate) => !(candidate in session.gameState.towns)
        )
        assertExists(spaceId, 'CP has open country')
        await session.placeTrack(spaceId)
        await settled(session)
        const hand = yourHand(turnPanel(session), session.gameState, session.myPlayer?.id)
        expect(hand?.slots.map((slot) => slot.kind)).toEqual([
            HandSlotKind.Placed,
            HandSlotKind.Piece,
            HandSlotKind.Piece
        ])
    })

    it('R-5: outside the viewer’s turn it is the viewer’s own next hand, dimmed, taking no press', () => {
        const state = hydrated(dealtTable().state)
        const second = seatOf(state, 1)
        const hand = yourHand(undefined, state, second)
        assertExists(hand, 'A seated viewer has a hand')
        expect(hand.dimmed).toBe(true)
        expect(hand.heading).toBe('Your next pieces')
        const own = state.getPlayerState(second).knownHand()
        expect(own).toHaveLength(3)
        expect(hand.slots).toEqual(
            own.map((railroadId) =>
                piece(railroadId, railroadId.replace('railroad.', '').toUpperCase())
            )
        )
    })

    it('R-5: a spectator has no hand, and the turn player’s hand is never shown as another seat’s', () => {
        const state = hydrated(dealtTable().state)
        expect(yourHand(undefined, state, undefined)).toBeUndefined()
        expect(yourHand(undefined, state, 'not-seated')).toBeUndefined()
    })

    it('R-4.3-H4: the viewer’s own turn without its panel shows the turn’s pieces, dimmed', () => {
        const state = hydrated(dealtTable().state)
        const first = seatOf(state, 0)
        const hand = yourHand(undefined, state, first)
        expect(hand?.dimmed).toBe(true)
        expect(hand?.slots).toEqual(
            (state.turn?.pieces ?? []).map((railroadId) =>
                piece(railroadId, railroadId.replace('railroad.', '').toUpperCase())
            )
        )
    })

    it('R-6.3-H2: a kept piece comes last, marked kept', () => {
        const dealt = dealtTable({ config: variantConfig(true) })
        const next = structuredClone(dealt.state)
        const player = next.players.find((seat) => seat.playerId === seatOf(next, 1))
        assertExists(player, 'seat 2')
        const index = next.bag.items.lastIndexOf(KP)
        next.bag.items.splice(index, 1)
        next.bag.remaining -= 1
        player.keptPiece = KP
        const hand = yourHand(undefined, hydrated(canonical(next)), player.playerId)
        expect(hand?.slots.at(-1)).toEqual(piece(KP, 'KP', { kept: true }))
    })

    it('R-6.1-H2: a seat the bag left with nothing says so', () => {
        const dealt = dealtTable()
        const next = structuredClone(dealt.state)
        const emptied = next.players.find((seat) => seat.playerId === seatOf(next, 1))
        assertExists(emptied, 'seat 2')
        next.bag.items.push(...(emptied.hand ?? []))
        next.bag.remaining += emptied.handCount
        emptied.hand = []
        emptied.handCount = 0
        const hand = yourHand(undefined, hydrated(canonical(next)), emptied.playerId)
        expect(hand?.slots).toEqual([])
        expect(hand?.note).toBe('none left in the bag')
    })
})
