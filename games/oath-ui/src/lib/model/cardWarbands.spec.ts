import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { sharedVisionIdsOf, warbandsOnCardOf } from './cardWarbands.js'

const CAGE = 'relic.obsidian-cage'
const CONQUEST = 'vision.conquest'
const REBELLION = 'vision.rebellion'

function board() {
    return testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, revealedVisionId: REBELLION }),
            testPlayer({ playerId: 'other', color: Color.Blue, revealedVisionId: CONQUEST })
        ],
        {
            warbandsOnCards: {
                [CAGE]: { me: 2, other: 0, [IMPERIAL_WARBANDS]: 1 },
                [CONQUEST]: { me: 1 }
            }
        }
    )
}

describe('warbandsOnCardOf', () => {
    it('lists each owner with warbands standing on the card, and no empty entry', () => {
        expect(warbandsOnCardOf(board(), CAGE)).toEqual([
            { owner: 'me', count: 2 },
            { owner: IMPERIAL_WARBANDS, count: 1 }
        ])
    })

    it('a card with nothing on it lists nothing', () => {
        expect(warbandsOnCardOf(board(), REBELLION)).toEqual([])
    })
})

describe('sharedVisionIdsOf', () => {
    it('another holder’s Vision under this player’s warband is shared, their own is not', () => {
        expect(sharedVisionIdsOf(board(), 'me')).toEqual([CONQUEST])
    })

    it('the holder of that Vision shares nothing', () => {
        expect(sharedVisionIdsOf(board(), 'other')).toEqual([])
    })
})
