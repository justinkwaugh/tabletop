import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { playDrawnCard } from '../testing/steps.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Ring of Devotion: "You cannot place warbands at sites." A When Played power that gains warbands and then places
// them (Key to the City) gains them and places none for its holder, at every revision (Law 9.2).

const RING = 'relic.ring-of-devotion'
const KEY = 'denizen.discord.key-to-the-city'
const REVISIONS = [OathRevision.EngineFixes27, OathRevision.EngineFixes26, OathRevision.Chronicle]

/** Rhys stands at p1, which Dana rules with 3 warbands while Dana's pawn is at c1. */
function table(revision: OathRevision, rhysRelics: string[]): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { dana: 2 },
                warbandsInPersonalBank: { dana: 5 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'p1',
                favor: 3,
                secrets: 3,
                supply: 4,
                warbandsOnBoard: { rhys: 4 },
                warbandsInPersonalBank: { rhys: 6 },
                relicIds: rhysRelics
            })
        ],
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 }, c2: { rhys: 2 }, p1: { dana: 3 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'rhys')
    return s
}

describe('Ring of Devotion against When Played placements (Law 9.2: the warbands are gained, none placed)', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: Key to the City kills Dana's warbands at p1, Rhys gains one and places none`, () => {
            const s = table(revision, [RING])
            playDrawnCard(s, KEY, SearchPlay.Site, undefined, 'rhys')
            expect(s.warbandsBySite['p1'] ?? {}).toEqual({ dana: 0 })
            expect(s.getPlayerState('rhys').warbandsOnBoard).toEqual({ rhys: 5 })
        })
    }
})
