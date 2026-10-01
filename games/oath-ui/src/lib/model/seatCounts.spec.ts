import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { seatWarbands } from './seatWarbands.js'
import { reliquarySpaces } from './reliquary.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

const CHAN = 'chan'
const CIT = 'cit'
const EXILE = 'exile'

function table() {
    return testState(
        [
            testPlayer({
                playerId: CHAN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }
            }),
            testPlayer({
                playerId: CIT,
                color: Color.Yellow,
                status: PlayerStatus.Citizen,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [CIT]: 14 }
            }),
            testPlayer({
                playerId: EXILE,
                color: Color.Red,
                warbandsOnBoard: { [EXILE]: 4 },
                warbandsInPersonalBank: { [EXILE]: 10 }
            })
        ],
        { chancellorPlayerId: CHAN }
    )
}

describe('a seat’s warbands (R-6.6.3)', () => {
    it('an Imperial seat counts the Empire\'s warbands, drawn from the one Imperial bank', () => {
        const state = table()
        expect(seatWarbands(state, CIT)).toEqual({
            owner: IMPERIAL_WARBANDS,
            onBoard: 2,
            inBank: seatWarbands(state, CHAN).inBank
        })
        expect(seatWarbands(state, CIT).inBank).not.toBe(14)
    })

    it('an Exile counts their own warbands', () => {
        expect(seatWarbands(table(), EXILE)).toEqual({ owner: EXILE, onBoard: 4, inBank: 10 })
    })
})

describe('the Reliquary’s spaces (R-2.3)', () => {
    it('an uncovered space leaves the others where they are', () => {
        const state = table()
        state.reliquary = state.reliquarySlots().filter((slot) => slot.slotId !== 'reliquary.1')
        expect(reliquarySpaces(state)).toEqual([
            { slotId: 'reliquary.0', covered: true },
            { slotId: 'reliquary.1', covered: false },
            { slotId: 'reliquary.2', covered: true },
            { slotId: 'reliquary.3', covered: true }
        ])
    })
})
