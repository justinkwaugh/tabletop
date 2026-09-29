import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_COLOR, PlayerStatus } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import type { HydratedOathGameState } from '@tabletop/oath'
import { peekedRelicAt } from './relicKnowledge.js'

/** R-6.3, R-6.4, R-9.4 — a peeked relic is named only to the player who peeked it. */

const PEEKER = 'peeker'
const OTHER = 'other'
const RELIC = 'relic.map'
const SLOT = 'c1.relic.0'

function board(): HydratedOathGameState {
    return testState(
        [
            testPlayer({
                playerId: PEEKER,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 20 },
                peekedRelicSlotIds: [SLOT],
                peekedRelics: { [SLOT]: RELIC }
            }),
            testPlayer({
                playerId: OTHER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { [Color.Red]: 3 },
                warbandsInPersonalBank: { [Color.Red]: 20 }
            })
        ],
        { relicsBySite: { c1: [{ slotId: SLOT }] } }
    )
}

describe('R-6.3 — a peeked relic is known to the peeker only', () => {
    it('shows the relic to the player who peeked it', () => {
        expect(peekedRelicAt(board(), PEEKER, SLOT)).toBe(RELIC)
    })

    it('hides it from a player who did not peek', () => {
        expect(peekedRelicAt(board(), OTHER, SLOT)).toBeUndefined()
    })

    it('names nothing for a slot the viewer has not peeked', () => {
        expect(peekedRelicAt(board(), PEEKER, 'c2.relic.0')).toBeUndefined()
    })

    it('conceals when there is no viewer, and when there is no slot', () => {
        expect(peekedRelicAt(board(), undefined, SLOT)).toBeUndefined()
        expect(peekedRelicAt(board(), PEEKER, undefined)).toBeUndefined()
    })

    it('reads the viewer’s own record, never the slot, which names no card', () => {
        const state = board()
        expect(state.relicSlotsAt('c1')).toEqual([{ slotId: SLOT }])
        expect(peekedRelicAt(state, PEEKER, SLOT)).toBe(RELIC)
    })
})
