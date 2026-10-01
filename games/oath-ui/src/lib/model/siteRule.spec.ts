import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { cardRulerIds, siteRuleOf } from './siteRule.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

const CROWN = 'relic.bandit-crown'
const MASK = 'relic.grand-mask'
const MESSENGER = 'denizen.order.messenger'
const ME = 'me'
const CHAN = 'chan'
const CIT = 'cit'

function board(myRelics: string[], turn = ME) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                relicIds: myRelics,
                warbandsOnBoard: { [ME]: 4 }
            }),
            testPlayer({
                playerId: CHAN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }
            }),
            testPlayer({
                playerId: CIT,
                color: Color.Yellow,
                status: PlayerStatus.Citizen,
                siteId: 'p1',
                warbandsInPersonalBank: { [CIT]: 14 }
            })
        ],
        {
            chancellorPlayerId: CHAN,
            denizensBySite: { p1: [MESSENGER] },
            warbandsBySite: { c1: { [ME]: 1 }, p1: { [IMPERIAL_WARBANDS]: 2 } }
        }
    )
    state.turnManager.series = [{ type: 'turn', playerId: turn, start: 0 }]
    state.activePlayerIds = [turn]
    return state
}

describe('siteRuleOf', () => {
    it('an empty faceup site is the bandits’, and nobody rules it', () => {
        expect(siteRuleOf(board([]), 'c2')).toEqual({
            rulerIds: [],
            banditsRule: true,
            banditsServeIds: []
        })
    })

    it('with the Bandit Crown the empty site is its holder’s, through the bandits', () => {
        expect(siteRuleOf(board([CROWN]), 'c2')).toEqual({
            rulerIds: [ME],
            banditsRule: false,
            banditsServeIds: [ME]
        })
    })

    it('a site holding warbands is ruled by them, and no bandits are named', () => {
        const rule = siteRuleOf(board([CROWN]), 'p1')
        expect(rule.rulerIds).toEqual([CHAN, CIT])
        expect(rule.banditsRule).toBe(false)
        expect(rule.banditsServeIds).toEqual([])
    })
})

describe('cardRulerIds', () => {
    it('a denizen at an Imperial site is ruled by the Imperial players', () => {
        expect(cardRulerIds(board([MASK], CHAN), MESSENGER)).toEqual([CHAN, CIT])
    })

    it('during the Grand Mask wearer’s turn the wearer rules it, and the Imperial players do not', () => {
        expect(cardRulerIds(board([MASK], ME), MESSENGER)).toEqual([ME])
    })
})
