import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve, reasonCannotPairSecondPlay, type SearchResolveChoice } from './searchResolve.js'
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

// Land Warden's Q&A: two cards played to sites may each use the People's Favor ("Yes!"); R-5.1.4.I lets the kept
// card go to any site in its holder's region. Each site's room counts the cards that go there.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const PAD = ['denizen.arcane.alchemist', 'denizen.arcane.dazzle', 'denizen.arcane.fire-talkers']

const NOW = OathRevision.EngineFixes12
const BEFORE = OathRevision.EngineFixes11

/** Dana holds Land Warden and the People's Favor at c1, which has `spaces` left; c2, in the same region, is empty. */
function searched(revision: OathRevision, spaces: number) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 6, advisers: [{ cardId: LAND_WARDEN, faceUp: true }] }),
            testPlayer({ playerId: 'bea', color: Color.Blue, siteId: 'h1', favor: 2, secrets: 2, advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: false }] })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            banners: testBanners({ [Banner.PeoplesFavor]: 'dana' })
        }
    )
    openTurn(s, 'dana')
    s.denizensBySite['c1'] = PAD.slice(0, effectiveSiteCapacity(s, 'c1') - spaces)
    s.requireVault().worldDeck = [WOLVES, INN, FILLER]
    new HydratedSearch(
        buildAction(Search, { playerId: 'dana', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })
    ).apply(s)
    return s
}

const keptTo = (toSiteId: string | undefined): SearchResolveChoice => ({
    keptCardId: WOLVES,
    discardOrder: [FILLER],
    play: SearchPlay.Site,
    ...(toSiteId ? { toSiteId } : {}),
    secondPlay: { cardId: INN, play: SearchPlay.Site }
})

describe("Land Warden with the People's Favor: the kept card to another site leaves your site to the second card", () => {
    it('the kept card to c2 and the second card to your site with one space: accepted, and each lands where it was sent', () => {
        const s = searched(NOW, 1)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', keptTo('c2'))).toBeUndefined()
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'dana', ...keptTo('c2') })).apply(s)
        expect(s.denizensBySite['c2']).toEqual([WOLVES])
        expect(s.denizensBySite['c1']).toEqual([...PAD.slice(0, 2), INN])
    })

    it('with no space at your site, the second card is refused there', () => {
        const s = searched(NOW, 0)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', keptTo('c2'))).toBe('second card: site c1 is at its capacity of 3')
    })

    it('both cards to your site with one space: no room for two, as before', () => {
        const s = searched(NOW, 1)
        expect(reasonCannotPairSecondPlay(s, 'dana', SearchPlay.Site, { cardId: INN, play: SearchPlay.Site })).toBe('no room at your site for two cards')
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', keptTo(undefined))).toBe('no room at your site for two cards')
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', keptTo('c1'))).toBe('no room at your site for two cards')
    })

    it('R-X.4 — before revision 16, the kept card counts at your site wherever it goes', () => {
        const s = searched(BEFORE, 1)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', keptTo('c2'))).toBe('no room at your site for two cards')
    })

    it("on Dana's own view, where Bea's facedown adviser and the vault cannot be read, the same answers", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        for (const [spaces, toSiteId, expected] of [
            [1, 'c2', undefined],
            [1, undefined, 'no room at your site for two cards'],
            [0, 'c2', 'second card: site c1 is at its capacity of 3']
        ] as const) {
            const s = searched(NOW, spaces)
            const server = JSON.stringify(s.dehydrate())
            const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)
            expect(reasonCannotPairSecondPlay(own, 'dana', SearchPlay.Site, { cardId: INN, play: SearchPlay.Site }, toSiteId)).toBe(
                reasonCannotPairSecondPlay(s, 'dana', SearchPlay.Site, { cardId: INN, play: SearchPlay.Site }, toSiteId)
            )
            expect(HydratedSearchResolve.reasonCannotResolve(own, 'dana', keptTo(toSiteId))).toBe(expected)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
        }
    })
})
