import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { boardWarbands, site, siteTarget, siteWarbands } from '../testing/choices.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { OathRevision } from '../util/revision.js'
import type { PowerChoice } from '../util/powerChoice.js'
import '../powers/index.js'

// R-6.5-H1 — Ring of Devotion's "You cannot place warbands at sites" binds the player who holds it, and from
// revision 31 bars that player's Messenger and Warning Signals moves to a site. It binds no one else: another
// player's moves to sites are made as before, and Warning Signals used by a Chancellor for a Citizen is judged
// by whether the Chancellor holds the Ring.

const RING = 'relic.ring-of-devotion'
const CROWN = 'relic.bandit-crown'
const MESSENGER = 'denizen.order.messenger'
const WARNING = 'denizen.nomad.warning-signals'
/** A pick the power does not offer is refused before its moves are read. */
const NOT_OFFERED = /is not among the options/
const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

/**
 * Dana and Rhys stand at c1. Rhys has 3 warbands on their board, rules c1 (1) and p1 (3), and holds Messenger and
 * Warning Signals faceup; Dana rules c2 (2).
 */
function duel(
    revision: OathRevision,
    danaRelics: string[],
    rhysRelics: string[]
): HydratedOathGameState {
    return testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                supply: 6,
                warbandsOnBoard: { dana: 3 },
                relicIds: danaRelics
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                warbandsOnBoard: { rhys: 3 },
                relicIds: rhysRelics,
                advisers: [
                    { cardId: MESSENGER, faceUp: true },
                    { cardId: WARNING, faceUp: true }
                ]
            })
        ],
        {
            oathRevision: revision,
            warbandsBySite: { c1: { rhys: 1 }, p1: { rhys: 3 }, c2: { dana: 2 } }
        }
    )
}

function messengerVerdict(s: HydratedOathGameState, choices: PowerChoice[]) {
    return HydratedUseActionPower.reasonCannotUse(
        s,
        'rhys',
        MESSENGER,
        powerIndexOf(MESSENGER, PowerTiming.Action),
        choices
    )
}

function warningPlan(choices: PowerChoice[]) {
    return { cardId: WARNING, powerIndex: powerIndexOf(WARNING, PowerTiming.BattlePlan), choices }
}

function attackRhysAtC1(s: HydratedOathGameState, attackerId: string): void {
    openTurn(s, attackerId)
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: attackerId,
            defender: { kind: 'player', playerId: 'rhys' },
            targets: [siteTarget('c1')],
            attackDice: 2
        })
    ).apply(s)
}

describe('Ring of Devotion binds its holder only: another player holding it changes nothing', () => {
    for (const revision of [FIXED, BEFORE]) {
        it(`revision ${revision}: Dana holds the Ring; Rhys's Messenger still moves to sites`, () => {
            const s = duel(revision, [RING], [])
            openTurn(s, 'rhys')
            expect(messengerVerdict(s, [boardWarbands('rhys', 'rhys', 2), site('p1')])).toBe(
                undefined
            )
            expect(messengerVerdict(s, [siteWarbands('p1', 'rhys', 2), site('c1')])).toBe(undefined)
        })

        it(`revision ${revision}: the attacker Dana holds the Ring; defender Rhys's Warning Signals still moves into c1`, () => {
            const s = duel(revision, [RING], [])
            attackRhysAtC1(s, 'dana')
            expect(
                HydratedCampaignDefend.reasonCannotDefend(s, 'rhys', [
                    warningPlan([siteWarbands('p1', 'rhys', 2), site('c1')])
                ])
            ).toBe(undefined)
            expect(
                HydratedCampaignDefend.reasonCannotDefend(s, 'rhys', [
                    warningPlan([boardWarbands('rhys', 'rhys', 2), site('c1')])
                ])
            ).toBe(undefined)
        })
    }
})

/**
 * Ann, an Exile, attacks the Citizen Rhys at c1, which holds 1 Imperial warband; the Chancellor Dana, at h1 with 3
 * Imperial warbands on their board and Warning Signals faceup, answers for the Empire. p1 holds 3 Imperial warbands.
 */
function empireDefends(revision: OathRevision, rhysRelics: string[], danaRelics: string[]) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 6,
                warbandsOnBoard: { ann: 4 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                favor: 2,
                relicIds: rhysRelics
            }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                relicIds: danaRelics,
                advisers: [{ cardId: WARNING, faceUp: true }]
            })
        ],
        {
            oathRevision: revision,
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, p1: { [IMPERIAL_WARBANDS]: 3 } }
        }
    )
    attackRhysAtC1(s, 'ann')
    return s
}

describe('Warning Signals used by the Chancellor as an Ally: the Ring is read for the plan’s user', () => {
    const intoC1 = [boardWarbands('dana', IMPERIAL_WARBANDS, 2), site('c1')]
    it('revision 31: the defending Citizen Rhys holds the Ring; Dana, without it, moves into c1', () => {
        const s = empireDefends(FIXED, [RING], [])
        const campaign = s.campaign
        assertExists(campaign, 'Ann has campaigned')
        expect(HydratedCampaignDefend.answeringQueue(campaign)).toEqual(['dana'])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'dana', [warningPlan(intoC1)])).toBe(
            undefined
        )
    })

    it('revision 31: Dana holds the Ring, so their move into c1 is refused and a lift to the board is not', () => {
        const s = empireDefends(FIXED, [], [RING])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'dana', [warningPlan(intoC1)])).toMatch(
            NOT_OFFERED
        )
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, 'dana', [
                warningPlan([siteWarbands('p1', IMPERIAL_WARBANDS, 2)])
            ])
        ).toBe(undefined)
    })

    it('revision 30: Dana holds the Ring, and the move into c1 is accepted as recorded', () => {
        const s = empireDefends(BEFORE, [], [RING])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'dana', [warningPlan(intoC1)])).toBe(
            undefined
        )
    })
})

describe('Warning Signals with the Bandit Crown beside the Ring (revision 31)', () => {
    it('the empty sites the Crown rules are not offered, and the last warband may still be lifted', () => {
        const s = duel(FIXED, [], [RING, CROWN])
        attackRhysAtC1(s, 'dana')
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, 'rhys', [
                warningPlan([siteWarbands('p1', 'rhys', 3)])
            ])
        ).toBe(undefined)
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, 'rhys', [
                warningPlan([siteWarbands('p1', 'rhys', 1), site('h1')])
            ])
        ).toMatch(NOT_OFFERED)
    })
})
