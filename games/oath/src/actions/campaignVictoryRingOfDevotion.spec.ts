import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { campaignRecords, testPlayer, testState } from '../testing/fixture.js'
import { HydratedCampaignResolveVictory } from './campaignResolveVictory.js'
import { siteTarget } from '../testing/choices.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Ring of Devotion: "You cannot place warbands at sites." At R-5.5.7.I the victor may place "any number, even zero"
// of their warbands on a targeted site, so its holder places none, at every revision (R-7.1.4-H1, Law 9.2).

const RING = 'relic.ring-of-devotion'
const RING_REASON = 'you cannot place warbands at sites (Ring of Devotion)'
const REVISIONS = [OathRevision.EngineFixes27, OathRevision.EngineFixes26, OathRevision.Chronicle]

/** Ann, an Exile with 4 warbands on their board, has won a Campaign against Rhys targeting c1. */
function won(revision: OathRevision, annRelics: string[]) {
    return testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { ann: 4 },
                relicIds: annRelics
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 4,
                warbandsOnBoard: { rhys: 2 }
            })
        ],
        {
            oathRevision: revision,
            warbandsBySite: { c1: {}, p1: {} },
            campaign: {
                attackerPlayerId: 'ann',
                defenderPlayerId: 'rhys',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [siteTarget('c1')],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 2,
                swords: 5,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                attackerVictorious: true
            }
        }
    )
}

function verdict(revision: OathRevision, annRelics: string[], count: number, siteId = 'c1') {
    return HydratedCampaignResolveVictory.reasonCannotResolveVictory(
        won(revision, annRelics),
        'ann',
        { placements: [{ siteId, owner: 'ann', count }], burnFavor: false }
    )
}

describe('Ring of Devotion at R-5.5.7.I: the victor places no warbands on a targeted site', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: one warband onto c1 is refused for the Ring's holder`, () => {
            expect(verdict(revision, [RING], 1)).toBe(RING_REASON)
        })

        it(`revision ${revision}: zero is "any number, even zero", so it is accepted`, () => {
            expect(verdict(revision, [RING], 0)).toBe(undefined)
        })

        it(`revision ${revision}: the Ring is reported before an untargeted site`, () => {
            expect(verdict(revision, [RING], 1, 'p1')).toBe(RING_REASON)
            expect(verdict(revision, [], 1, 'p1')).toMatch(/was not targeted/)
        })
    }
})
