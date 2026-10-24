import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { FILLER, INN } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Land Warden plays the kept card first, then the second card. Salt the Earth: "You cannot play Salt the Earth to a
// site with any locked cards. ... This site's capacity is now 1." Law 5.1.4.I: "You cannot play to your site if it
// is at capacity (2.8.1)." So the second card's play to a site is judged on the site as the kept card leaves it.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const SALT = 'denizen.discord.salt-the-earth'
const BOILING_LAKE = 'denizen.discord.boiling-lake'
const FULL = ['denizen.arcane.alchemist', 'denizen.arcane.dazzle', 'denizen.arcane.fire-talkers']

const FIXED = OathRevision.EngineFixes25
const BEFORE = OathRevision.EngineFixes24

/**
 * Dana holds Land Warden at the Plains (c1, capacity 3) and has searched the world deck with it, drawing `top`.
 * With `favor`, Dana also holds the People's Favor, so the kept card may go to the River (c2), in the same region.
 */
function searched(
    revision: OathRevision,
    top: string[],
    { c1 = [] as string[], favor = false } = {}
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(favor ? { banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }) } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = top
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(LAND_WARDEN)]
        })
    ).apply(s)
    return s
}

/** The kept card to Dana's site, the second card as `second` says, the filler discarded. */
function keptThenSecond(
    kept: string,
    second: SearchResolveChoice['secondPlay'],
    keptPlay: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId: kept,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        ...keptPlay,
        secondPlay: second
    }
}

const saltThenInn = keptThenSecond(SALT, { cardId: INN, play: SearchPlay.Site })
const lakeThenSalt = keptThenSecond(BOILING_LAKE, { cardId: SALT, play: SearchPlay.Site })
const innThenSalt = keptThenSecond(INN, { cardId: SALT, play: SearchPlay.Site })

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

function resolveOf(s: HydratedOathGameState, choice: SearchResolveChoice) {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...choice })).apply(s)
}

describe("Land Warden from revision 29: the second card's site play is judged on the site the kept card leaves", () => {
    it('Salt the Earth kept to your site leaves its capacity at 1, so a second card to that site is refused', () => {
        const s = searched(FIXED, [SALT, INN, FILLER])
        expect(checkOf(s, saltThenInn)).toBe('second card: site c1 is at its capacity of 1')
    })

    it('a locked card kept to your site: Salt the Earth as the second card to that site is refused', () => {
        const s = searched(FIXED, [BOILING_LAKE, SALT, FILLER])
        expect(checkOf(s, lakeThenSalt)).toBe(
            'second card: Salt the Earth cannot be played to a site with any locked cards'
        )
    })

    it('Salt the Earth kept to your site, the second card as a facedown adviser, is accepted', () => {
        const s = searched(FIXED, [SALT, INN, FILLER])
        const choice = keptThenSecond(SALT, {
            cardId: INN,
            play: SearchPlay.Adviser,
            faceUp: false
        })
        expect(checkOf(s, choice)).toBeUndefined()
        resolveOf(s, choice)
        expect(s.denizensBySite['c1']).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })

    it('the Wayside Inn kept to your site, then Salt the Earth second: accepted, and Salt discards the Inn', () => {
        const s = searched(FIXED, [INN, SALT, FILLER])
        expect(checkOf(s, innThenSalt)).toBeUndefined()
        resolveOf(s, innThenSalt)
        expect(s.denizensBySite['c1']).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })

    it('a full site with Salt the Earth kept to it: a second card to that site is still refused', () => {
        const s = searched(FIXED, [SALT, INN, FILLER], { c1: FULL })
        expect(FULL).toHaveLength(effectiveSiteCapacity(s, 'c1'))
        expect(checkOf(s, saltThenInn)).toBe('second card: site c1 is at its capacity of 1')
    })

    it("Salt the Earth kept to another site by the People's Favor leaves your own site's capacity: a second card to it is accepted", () => {
        const s = searched(FIXED, [SALT, INN, FILLER], { favor: true })
        const choice = keptThenSecond(
            SALT,
            { cardId: INN, play: SearchPlay.Site },
            { toSiteId: 'c2' }
        )
        expect(checkOf(s, choice)).toBeUndefined()
        resolveOf(s, choice)
        expect(s.denizensBySite['c1']).toEqual([INN])
        expect(s.denizensBySite['c2']).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
        expect(effectiveSiteCapacity(s, 'c2')).toBe(1)
    })

    it("the check runs on Dana's own view as on the full state", () => {
        const own = (s: HydratedOathGameState) =>
            new HydratedOathGameState(served(s, { kind: 'player', playerId: 'dana' }))
        const scenes: [string, () => HydratedOathGameState, SearchResolveChoice][] = [
            ['salt then inn', () => searched(FIXED, [SALT, INN, FILLER]), saltThenInn],
            ['lake then salt', () => searched(FIXED, [BOILING_LAKE, SALT, FILLER]), lakeThenSalt],
            ['inn then salt', () => searched(FIXED, [INN, SALT, FILLER]), innThenSalt]
        ]
        for (const [name, scene, choice] of scenes) {
            const s = scene()
            expect(checkOf(own(s), choice), name).toEqual(checkOf(s, choice))
        }
    })

    it('before revision 29 a game keeps the check it was recorded with: both pairs are accepted', () => {
        const salted = searched(BEFORE, [SALT, INN, FILLER])
        expect(checkOf(salted, saltThenInn)).toBeUndefined()
        resolveOf(salted, saltThenInn)
        expect(salted.denizensBySite['c1']).toEqual([SALT, INN])
        expect(effectiveSiteCapacity(salted, 'c1')).toBe(1)

        const locked = searched(BEFORE, [BOILING_LAKE, SALT, FILLER])
        expect(checkOf(locked, lakeThenSalt)).toBeUndefined()
        resolveOf(locked, lakeThenSalt)
        expect(locked.denizensBySite['c1']).toEqual([BOILING_LAKE, SALT])
        expect(effectiveSiteCapacity(locked, 'c1')).toBe(1)
    })
})
