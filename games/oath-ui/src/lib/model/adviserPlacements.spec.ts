import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, PlayerStatus, SearchPlay } from '@tabletop/oath'
import { FIXTURE_SITE_CAPACITY, testPlayer, testState } from '@tabletop/oath/testing'
import { adviserOtherSites, adviserPlacements } from './adviserPlacements.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'


const UNRESTRICTED = 'denizen.beast.errand-boy'
const SITE_ONLY = 'denizen.discord.boiling-lake'
const ADVISER_ONLY = 'denizen.order.vow-of-obedience'
const VISION = 'vision.faith'

function table(advisers: { cardId: string; faceUp: boolean }[], status = PlayerStatus.Exile) {
    return testState([
        testPlayer({
            playerId: 'p1',
            color: Color.Red,
            status,
            siteId: 'c1',
            advisers,
            warbandsOnBoard: { [IMPERIAL_WARBANDS]: 0 }
        })
    ])
}

function offered(state: ReturnType<typeof table>, cardId: string): SearchPlay[] {
    return adviserPlacements(state, 'p1', cardId)
        .filter((option) => option.blockedBecause === undefined)
        .map((option) => option.play)
}

describe('R-6.1 — where a facedown adviser may go', () => {
    it('an unrestricted denizen may go to a site, faceup, or the pile', () => {
        const state = table([{ cardId: UNRESTRICTED, faceUp: false }])
        expect(offered(state, UNRESTRICTED)).toEqual([
            SearchPlay.Site,
            SearchPlay.Adviser,
            SearchPlay.Discard
        ])
    })

    it('R-7.2.1 — a site-only denizen is playable to a site, not merely discardable', () => {
        const state = table([{ cardId: SITE_ONLY, faceUp: false }])
        expect(offered(state, SITE_ONLY)).toEqual([SearchPlay.Site, SearchPlay.Discard])
    })

    it('R-7.2.1 — an adviser-only denizen goes faceup, and not to a site', () => {
        const state = table([{ cardId: ADVISER_ONLY, faceUp: false }])
        expect(offered(state, ADVISER_ONLY)).toEqual([SearchPlay.Adviser, SearchPlay.Discard])
    })

    it('R-5.1.4.II — at the adviser limit, the card still turns faceup', () => {
        // The card played is one of the three, so the slot it vacates does not count against it.
        const state = table([
            { cardId: UNRESTRICTED, faceUp: false },
            { cardId: ADVISER_ONLY, faceUp: true },
            { cardId: 'denizen.hearth.rowdy-pub', faceUp: true }
        ])
        expect(state.getPlayerState('p1').advisers).toHaveLength(3)
        expect(state.getPlayerState('p1').adviserLimit).toBe(3)
        expect(offered(state, UNRESTRICTED)).toContain(SearchPlay.Adviser)
    })

    it('R-5.1.4.III — an Exile may reveal a facedown Vision; a Chancellor may not', () => {
        // The Revealed Vision space is printed on the Exile side of the board.
        const exile = table([{ cardId: VISION, faceUp: false }])
        expect(offered(exile, VISION)).toContain(SearchPlay.RevealedVision)

        const chancellor = table([{ cardId: VISION, faceUp: false }], PlayerStatus.Chancellor)
        expect(offered(chancellor, VISION)).not.toContain(SearchPlay.RevealedVision)
    })
})

describe("R-6.1, R-5.1.4.I — a full site does not close the site play to the People's Favor's holder", () => {
    it('offers the site play when another site in the region has room; without the banner it stays refused', () => {
        const full = Array.from({ length: FIXTURE_SITE_CAPACITY }, (_, i) => `denizen.order.filler-${i}`)
        const at = (holder: string) =>
            testState(
                [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', advisers: [{ cardId: UNRESTRICTED, faceUp: false }] })],
                {
                    denizensBySite: { c1: full, c2: [], p1: [] },
                    banners: {
                        [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: holder },
                        [Banner.DarkestSecret]: { value: 1 }
                    }
                }
            )
        expect(offered(at('p1'), UNRESTRICTED)).toContain(SearchPlay.Site)
        expect(adviserOtherSites(at('p1'), 'p1', UNRESTRICTED)).toContain('c2')
        expect(offered(at('p2'), UNRESTRICTED)).not.toContain(SearchPlay.Site)
    })
})

describe('R-6.1 — what a refused placement says', () => {
    it('keeps the site and adviser placements visible, and explains them', () => {
        const state = table([{ cardId: SITE_ONLY, faceUp: false }])
        const adviser = adviserPlacements(state, 'p1', SITE_ONLY).find(
            (option) => option.play === SearchPlay.Adviser
        )
        expect(adviser).toBeDefined()
        expect(adviser?.blockedBecause).toContain('can only be played to a site')
    })

    it('drops the placements no player is reaching for', () => {
        const state = table([{ cardId: UNRESTRICTED, faceUp: false }])
        const plays = adviserPlacements(state, 'p1', UNRESTRICTED).map((o) => o.play)
        expect(plays).not.toContain(SearchPlay.Conspiracy)
        expect(plays).not.toContain(SearchPlay.RevealedVision)
    })

    it('a faceup adviser has no placements at all', () => {
        // R-6.1 plays only facedown advisers; a faceup one is already played.
        const state = table([{ cardId: UNRESTRICTED, faceUp: true }])
        expect(offered(state, UNRESTRICTED)).toEqual([])
    })
})
