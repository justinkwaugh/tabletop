import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { playDrawnCard } from '../testing/steps.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Ring of Devotion: "You cannot place warbands at sites." Its Q&A asks "What cases does this cover?" and answers "All
// of them!" A When Played power that gains warbands and then places them (Key to the City, Garrison) gains them to
// its holder's board and places none, at every revision (Law 9.2: "cannot" ranks above other rules).

const RING = 'relic.ring-of-devotion'
const KEY = 'denizen.discord.key-to-the-city'
const GARRISON = 'denizen.order.garrison'
const REVISIONS = [
    OathRevision.EngineFixes28,
    OathRevision.EngineFixes27,
    OathRevision.EngineFixes26,
    OathRevision.Chronicle
]

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

/**
 * Dana's turn: Dana (Exile) stands at c1 and rules c1 (1 warband) and p1 (3), with 2 warbands on their board and 5 in
 * their bank; Rhys rules c2 (2).
 */
function garrisonTable(revision: OathRevision, danaRelics: string[]): HydratedOathGameState {
    const s = table(revision, [])
    s.getPlayerState('dana').relicIds = danaRelics
    openTurn(s, 'dana')
    return s
}

describe('Ring of Devotion against Garrison (Law 9.2: the warbands are gained, none placed)', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: Dana, holding the Ring, rules two sites: they gain two warbands to the board and place none`, () => {
            const s = garrisonTable(revision, [RING])
            const a = playDrawnCard(s, GARRISON, SearchPlay.Site, undefined, 'dana')
            expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 4 })
            expect(s.getPlayerState('dana').warbandsInPersonalBank).toEqual({ dana: 3 })
            expect(s.warbandsBySite['c1']).toEqual({ dana: 1 })
            expect(s.warbandsBySite['p1']).toEqual({ dana: 3 })
            expect(a.metadata?.whenPlayed).toMatch(/gained 2 warbands; placed none/)
        })

        it(`revision ${revision}: control: without the Ring, Dana gains two and places one on each site they rule`, () => {
            const s = garrisonTable(revision, [])
            const a = playDrawnCard(s, GARRISON, SearchPlay.Site, undefined, 'dana')
            expect(s.getPlayerState('dana').warbandsOnBoard).toEqual({ dana: 2 })
            expect(s.warbandsBySite['c1']).toEqual({ dana: 2 })
            expect(s.warbandsBySite['p1']).toEqual({ dana: 4 })
            expect(a.metadata?.whenPlayed).toMatch(/gained 2 warbands and placed 2 across 2/)
        })
    }
})

/**
 * Rhys is a Citizen holding the Ring, at p1, which the Exile Dana rules with 3 warbands while Dana's pawn is at c1.
 * The Chancellor Mara stands at h1 with 6 Imperial warbands in their bank; c2 and h1 hold 1 Imperial warband each,
 * so the Empire, and Rhys with it (R-6.6.3), rules those two sites.
 */
function citizenTable(revision: OathRevision, rhysRelics: string[]): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { dana: 2 },
                warbandsInPersonalBank: { dana: 5 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'p1',
                favor: 3,
                secrets: 3,
                supply: 4,
                warbandsInPersonalBank: { rhys: 6 },
                relicIds: rhysRelics
            }),
            testPlayer({
                playerId: 'mara',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 6 }
            })
        ],
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: {
                c1: { dana: 1 },
                c2: { [IMPERIAL_WARBANDS]: 1 },
                p1: { dana: 3 },
                h1: { [IMPERIAL_WARBANDS]: 1 }
            },
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

describe('Ring of Devotion held by a Citizen: the Imperial warbands are gained, none placed', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: Key to the City kills Dana's warbands at p1; Rhys gains an Imperial warband and places none`, () => {
            const s = citizenTable(revision, [RING])
            playDrawnCard(s, KEY, SearchPlay.Site, undefined, 'rhys')
            expect(s.warbandsBySite['p1'] ?? {}).toEqual({ dana: 0 })
            expect(s.getPlayerState('rhys').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 1 })
            expect(s.getPlayerState('mara').warbandsInPersonalBank).toEqual({
                [IMPERIAL_WARBANDS]: 5
            })
        })

        it(`revision ${revision}: Garrison: Rhys gains an Imperial warband per site the Empire rules and places none`, () => {
            const s = citizenTable(revision, [RING])
            const a = playDrawnCard(s, GARRISON, SearchPlay.Site, undefined, 'rhys')
            expect(s.getPlayerState('rhys').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 2 })
            expect(s.warbandsBySite['c2']).toEqual({ [IMPERIAL_WARBANDS]: 1 })
            expect(s.warbandsBySite['h1']).toEqual({ [IMPERIAL_WARBANDS]: 1 })
            expect(a.metadata?.whenPlayed).toMatch(/placed none/)
        })

        it(`revision ${revision}: control: without the Ring, Rhys's Garrison places an Imperial warband on each`, () => {
            const s = citizenTable(revision, [])
            playDrawnCard(s, GARRISON, SearchPlay.Site, undefined, 'rhys')
            expect(s.getPlayerState('rhys').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 0 })
            expect(s.warbandsBySite['c2']).toEqual({ [IMPERIAL_WARBANDS]: 2 })
            expect(s.warbandsBySite['h1']).toEqual({ [IMPERIAL_WARBANDS]: 2 })
        })
    }
})
