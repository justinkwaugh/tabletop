import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { FILLER, INN } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Land Warden's two plays to your site on one Search, with the Search's modifiers in use (Law 7.4.3: "A modifier
// cannot be discarded during the major action it is modifying"). Salt the Earth second may follow the kept card into
// your site's last space, and leaves Land Warden there when Land Warden is the Search's modifier at that site. A card
// the kept card discards first frees its space for the second card, but a modifier in use cannot be that card.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const SALT = 'denizen.discord.salt-the-earth'
const WELCOMING = 'denizen.hearth.welcoming-party'
const WOLVES = 'denizen.beast.wolves'
const LONGBOWS = 'denizen.order.longbows'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

/**
 * Dana at c1 (the Plains, capacity 3) holding `c1`, with `advisers`, has searched the world deck with `modifiers`
 * declared, drawing `top`. With `favor`, Dana also holds the People's Favor.
 */
function searched(
    revision: OathRevision,
    {
        c1,
        advisers = [] as string[],
        modifiers,
        top,
        favor = false
    }: { c1: string[]; advisers?: string[]; modifiers: string[]; top: string[]; favor?: boolean }
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2 })
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
    s.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: modifiers.map((cardId) => modifierUse(cardId))
        })
    ).apply(s)
    return s
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolveOf(s: HydratedOathGameState, choice: SearchResolveChoice) {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...choice })).apply(s)
}

const sorted = (ids: readonly string[]) => [...ids].sort()

describe('Land Warden in use at your site: the Inn kept to the last space, Salt the Earth second', () => {
    const table = { c1: [LAND_WARDEN, WOLVES], modifiers: [LAND_WARDEN], top: [INN, SALT, FILLER] }
    const innThenSalt: SearchResolveChoice = {
        keptCardId: INN,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        secondPlay: { cardId: SALT, play: SearchPlay.Site }
    }

    it('from revision 31: accepted, and Salt the Earth discards the Inn and the Wolves but leaves Land Warden', () => {
        const s = searched(FIXED, table)
        expect(s.denizensAt('c1')).toHaveLength(2)
        expect(checkOf(s, innThenSalt)).toBeUndefined()
        resolveOf(s, innThenSalt)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([LAND_WARDEN, SALT]))
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it("from revision 31, on Dana's own view: the same answer", () => {
        const s = searched(FIXED, table)
        expect(checkOf(ownView(s), innThenSalt)).toBeUndefined()
    })

    it('at revision 30: refused for room, as the game was recorded', () => {
        const s = searched(BEFORE, table)
        expect(checkOf(s, innThenSalt)).toBe('no room at your site for two cards')
    })
})

describe("the People's Favor: the Inn kept to your site, discarding first, Longbows second there", () => {
    // Land Warden as an adviser, Welcoming Party at the site, both declared: the Plains holds 2 of its 3.
    const table = {
        c1: [WELCOMING, WOLVES],
        advisers: [LAND_WARDEN],
        modifiers: [LAND_WARDEN, WELCOMING],
        top: [INN, LONGBOWS, FILLER],
        favor: true
    }
    const innFirst = (first: string): SearchResolveChoice => ({
        keptCardId: INN,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        discardFirstCardId: first,
        secondPlay: { cardId: LONGBOWS, play: SearchPlay.Site }
    })
    const inUse = `${WELCOMING} is a modifier in use and cannot be discarded during the action it modifies`

    it('from revision 31: Welcoming Party, in use, cannot be the card discarded first, so its space is not freed', () => {
        const s = searched(FIXED, table)
        expect(checkOf(s, innFirst(WELCOMING))).toBe(inUse)
        expect(checkOf(ownView(s), innFirst(WELCOMING))).toBe(inUse)
    })

    it('from revision 31, control: the Wolves discarded first free the space, and Longbows fills it', () => {
        const s = searched(FIXED, table)
        expect(checkOf(s, innFirst(WOLVES))).toBeUndefined()
        resolveOf(s, innFirst(WOLVES))
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([WELCOMING, INN, LONGBOWS]))
    })

    it('at revision 30: either card discarded first leaves the pair refused for room, as the game was recorded', () => {
        const s = searched(BEFORE, table)
        expect(checkOf(s, innFirst(WELCOMING))).toBe('no room at your site for two cards')
        expect(checkOf(s, innFirst(WOLVES))).toBe('no room at your site for two cards')
    })
})
