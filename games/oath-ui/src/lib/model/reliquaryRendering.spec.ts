import { describe, expect, it } from 'vitest'
import { RELIQUARY_SPACES, uncoveredReliquarySpaces } from '@tabletop/oath'
import { Color } from '@tabletop/common'
import { IMPERIAL_COLOR, PlayerStatus } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { reliquarySpaces } from './reliquary.js'

/** R-2.3 — a Reliquary space is covered while its slot is present, and a slot names no card. */

function board(coveredSlotIds: string[]) {
    return testState(
        [
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 20 }
            })
        ],
        { reliquary: coveredSlotIds.map((slotId) => ({ slotId })) }
    )
}

/** What the placard draws for each space, read from `reliquarySpaces`. */
function renderPlan(state: ReturnType<typeof board>): ('covered' | 'uncovered')[] {
    return reliquarySpaces(state).map((space) => (space.covered ? 'covered' : 'uncovered'))
}

describe('R-2.3 — the Imperial Reliquary', () => {
    it('holds four relics at setup, and draws four of them', () => {
        const state = board(['reliquary.0', 'reliquary.1', 'reliquary.2', 'reliquary.3'])
        expect(state.reliquarySlots()).toEqual(
            ['reliquary.0', 'reliquary.1', 'reliquary.2', 'reliquary.3'].map((slotId) => ({ slotId }))
        )
        expect(renderPlan(state)).toEqual(['covered', 'covered', 'covered', 'covered'])
    })

    it('R-6.6.2.a — draws the uncovered space in its own position', () => {
        // A middle space, because each space prints its own modifier.
        const state = board(['reliquary.0', 'reliquary.2', 'reliquary.3'])
        expect(renderPlan(state)).toEqual(['covered', 'uncovered', 'covered', 'covered'])
        expect(uncoveredReliquarySpaces(state)).toBe(1)
    })

    it('an empty array is four uncovered spaces, not four missing ones', () => {
        const state = board([])
        expect(renderPlan(state)).toEqual([
            'uncovered',
            'uncovered',
            'uncovered',
            'uncovered'
        ])
        expect(uncoveredReliquarySpaces(state)).toBe(RELIQUARY_SPACES)
    })

    it('R-2.3 — there are exactly four spaces', () => {
        expect(RELIQUARY_SPACES).toBe(4)
    })
})
