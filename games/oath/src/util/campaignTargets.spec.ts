import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PowerTiming, cardPowers } from '../data/cardPowers.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { required } from '../testing/required.js'
import { campaignTargetOptions, sitesDefendedBy } from './campaignTargets.js'
import '../powers/index.js'

const ME = 'me'
const FOE = 'foe'
const CHAN = 'chan'
const CIT = 'cit'
const CROWN = 'relic.bandit-crown'
const MESSENGER = 'denizen.order.messenger'
const HUNTER = 'denizen.order.relic-hunter'
const HUNTER_PLAN = {
    cardId: HUNTER,
    powerIndex: required(
        cardPowers(HUNTER).find((power) => power.timing === PowerTiming.BattlePlan),
        'Relic Hunter’s battle plan'
    ).powerIndex
}
const FOE_DEFENDS = { kind: 'player', playerId: FOE } as const
const SITE_C2: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'c2' }
const RELIC_AT_C2: CampaignTarget = { kind: CampaignTargetKind.SiteRelic, slotId: 'c2-r1' }

function campaignBoard() {
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', warbandsOnBoard: { [Color.Red]: 4 } }),
            testPlayer({ playerId: FOE, color: Color.Yellow, siteId: 'c1', relicIds: ['relic.map'] })
        ],
        {
            warbandsBySite: { c2: { [Color.Yellow]: 2 } },
            relicsBySite: { c2: [{ slotId: 'c2-r1' }] }
        }
    )
    state.banners[Banner.PeoplesFavor].holderPlayerId = FOE
    return state
}

function imperialBoard(myRelics: string[]) {
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', relicIds: myRelics, warbandsOnBoard: { [Color.Red]: 4 } }),
            testPlayer({
                playerId: CHAN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 8 }
            }),
            testPlayer({ playerId: CIT, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p1', warbandsInPersonalBank: { [Color.Yellow]: 14 } })
        ],
        {
            chancellorPlayerId: CHAN,
            denizensBySite: { p1: [MESSENGER] },
            warbandsBySite: { c1: { [Color.Red]: 1 }, p1: { [IMPERIAL_COLOR]: 2 } }
        }
    )
    state.turnManager.series = [{ type: 'turn', playerId: ME, start: 0 }]
    state.activePlayerIds = [ME]
    return state
}

describe('campaignTargetOptions — what a Campaign can target (R-5.5.2)', () => {
    it('a player can lose the sites they rule, their relics and banners, and their pawn', () => {
        expect(campaignTargetOptions(campaignBoard(), FOE_DEFENDS, [], [])).toEqual([
            SITE_C2,
            { kind: CampaignTargetKind.Relic, cardId: 'relic.map' },
            { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor },
            { kind: CampaignTargetKind.PawnAndFavor }
        ])
    })

    it('the bandits have only sites to lose (R-10.3)', () => {
        const options = campaignTargetOptions(campaignBoard(), { kind: 'bandits' }, [], [])
        expect(options.length).toBeGreaterThan(0)
        expect(options.every((target) => target.kind === CampaignTargetKind.Site)).toBe(true)
    })

    it('Relic Hunter offers the relics at a chosen site only while its plan is declared', () => {
        const state = campaignBoard()
        expect(campaignTargetOptions(state, FOE_DEFENDS, [HUNTER_PLAN], [SITE_C2])).toContainEqual(RELIC_AT_C2)
        expect(campaignTargetOptions(state, FOE_DEFENDS, [], [SITE_C2])).not.toContainEqual(RELIC_AT_C2)
        expect(campaignTargetOptions(state, FOE_DEFENDS, [HUNTER_PLAN], [])).not.toContainEqual(RELIC_AT_C2)
    })
})

describe('sitesDefendedBy', () => {
    it('the bandits defend the empty sites', () => {
        expect(sitesDefendedBy(imperialBoard([]), { kind: 'bandits' })).toEqual(['c2', 'p2', 'p3', 'h1', 'h2', 'h3'])
    })

    it('a player defends every site they rule, empty ones included under the Bandit Crown', () => {
        const state = imperialBoard([CROWN])
        expect(sitesDefendedBy(state, { kind: 'bandits' })).toEqual([])
        expect(sitesDefendedBy(state, { kind: 'player', playerId: ME })).toEqual(['c1', 'c2', 'p2', 'p3', 'h1', 'h2', 'h3'])
    })

    it('a Citizen defends the purple sites as well as their own', () => {
        expect(sitesDefendedBy(imperialBoard([]), { kind: 'player', playerId: CIT })).toEqual(['p1'])
    })
})
