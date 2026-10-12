import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { CampaignTargetKind, OathRevision, PlayerStatus } from '@tabletop/oath'
import { campaignRecords, testPlayer, testState } from '@tabletop/oath/testing'
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
            banditsHolderId: undefined,
            banditsImperial: false
        })
    })

    it('with the Bandit Crown the empty site is its holder’s, through the bandits', () => {
        expect(siteRuleOf(board([CROWN]), 'c2')).toEqual({
            rulerIds: [ME],
            banditsRule: false,
            banditsHolderId: ME,
            banditsImperial: false
        })
    })

    it('a site holding warbands is ruled by them, and no bandits are named', () => {
        const rule = siteRuleOf(board([CROWN]), 'p1')
        expect(rule.rulerIds).toEqual([CHAN, CIT])
        expect(rule.banditsRule).toBe(false)
        expect(rule.banditsHolderId).toBeUndefined()
        expect(rule.banditsImperial).toBe(false)
    })
})

/** R-7.6.5 with R-6.6.3 — the Crown's Q&A: for the Chancellor or a Citizen the bandits are purple warbands. */
describe('siteRuleOf: the Bandit Crown held by an Imperial player', () => {
    function crowned(holderId: string, oathRevision: number) {
        const state = board([])
        state.oathRevision = oathRevision
        state.getPlayerState(holderId).relicIds = [CROWN]
        return state
    }

    /** R-5.5.1.a — a Campaign whose scope suspends the Citizen. */
    function campaigning(state: ReturnType<typeof board>, attackerId: string, defenderId: string) {
        state.campaign = {
            attackerPlayerId: attackerId,
            defenderPlayerId: defenderId,
            nonImperialPlayerIds: [CIT],
            allyPlayerIds: [],
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'p1' }],
            attackPool: 1,
            defensePool: 0,
            attackRoll: [],
            defenseRoll: [],
            defense: 0,
            swords: 0,
            defendingForce: [],
            defendingBandits: 0,
            ...campaignRecords()
        }
        return state
    }

    const AT_REVISION = OathRevision.EngineFixes2
    const BEFORE = OathRevision.CardFixes1

    it('a Citizen holder: every Imperial player rules the empty site, and the bandits serve her as Imperial warbands', () => {
        expect(siteRuleOf(crowned(CIT, AT_REVISION), 'c2')).toEqual({
            rulerIds: [CHAN, CIT],
            banditsRule: false,
            banditsHolderId: CIT,
            banditsImperial: true
        })
    })

    it('a Chancellor holder: the same, the holder named alone', () => {
        expect(siteRuleOf(crowned(CHAN, AT_REVISION), 'c2')).toEqual({
            rulerIds: [CHAN, CIT],
            banditsRule: false,
            banditsHolderId: CHAN,
            banditsImperial: true
        })
    })

    it('R-X.4 — a game created before the revision keeps the holder alone, in her own colour', () => {
        for (const holderId of [CIT, CHAN]) {
            expect(siteRuleOf(crowned(holderId, BEFORE), 'c2'), holderId).toEqual({
                rulerIds: [holderId],
                banditsRule: false,
                banditsHolderId: holderId,
                banditsImperial: false
            })
        }
    })

    it('R-5.5.1.a — while her Campaign against the Chancellor suspends the Citizen holder, the empty site is hers alone, not Imperial', () => {
        const state = campaigning(crowned(CIT, AT_REVISION), CIT, CHAN)
        expect(siteRuleOf(state, 'c2')).toEqual({
            rulerIds: [CIT],
            banditsRule: false,
            banditsHolderId: CIT,
            banditsImperial: false
        })
        // The Empire's own warbands are the Chancellor's alone for that Campaign.
        expect(siteRuleOf(state, 'p1').rulerIds).toEqual([CHAN])

        state.campaign = undefined
        expect(siteRuleOf(state, 'c2').banditsImperial).toBe(true)
        expect(siteRuleOf(state, 'c2').rulerIds).toEqual([CHAN, CIT])
    })

    it('R-5.5.1.a — the Chancellor attacking the Citizen holder reverts her too', () => {
        const state = campaigning(crowned(CIT, AT_REVISION), CHAN, CIT)
        expect(siteRuleOf(state, 'c2')).toEqual({
            rulerIds: [CIT],
            banditsRule: false,
            banditsHolderId: CIT,
            banditsImperial: false
        })
    })

    it('an Exile holder is unchanged at the revision: her colour, hers alone', () => {
        expect(siteRuleOf(crowned(ME, AT_REVISION), 'c2')).toEqual({
            rulerIds: [ME],
            banditsRule: false,
            banditsHolderId: ME,
            banditsImperial: false
        })
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
