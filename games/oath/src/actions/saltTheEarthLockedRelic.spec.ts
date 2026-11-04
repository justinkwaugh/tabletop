import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedSearchResolve, SearchPlay, type SearchResolveChoice } from './searchResolve.js'
import { HydratedPlayFacedownAdviser } from './playFacedownAdviser.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics,
    withChancellor
} from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { FILLER, INN } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { reasonCannotPlaceCard } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Salt the Earth: "You cannot play Salt the Earth to a site with any locked cards." Ancient Bloodline: "Your
// enemies act as if denizens and relics at sites you rule are locked." Law 7.2.2. So a relic at a site the
// Bloodline's holder rules is a locked card there for their enemies, and bars their Salt the Earth.

const SALT = 'denizen.discord.salt-the-earth'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RELIC = 'relic.brass-horse'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle
const REFUSED = 'Salt the Earth cannot be played to a site with any locked cards'

/**
 * Dana and Rhys, both Exiles, stand at c1. Rhys rules `site` (c1 unless named) with two warbands and, with
 * `bloodline`, holds Ancient Bloodline faceup. With `relic` that site holds one facedown relic and nothing else
 * unless `denizens` says so. With `favor`, Dana holds the People's Favor, so they may play to c2 in their region.
 */
function table(
    revision: OathRevision,
    {
        relic = true,
        bloodline = true,
        denizens = [] as string[],
        site = 'c1',
        favor = false,
        dana = {} as Parameters<typeof testPlayer>[0]
    } = {}
): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 6,
                ...dana
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                advisers: bloodline ? [{ cardId: BLOODLINE, faceUp: true }] : []
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], [site]: denizens },
            warbandsBySite: { [site]: { [RHYS]: 2 } },
            ...(relic
                ? {
                      relicsBySite: { [site]: [{ slotId: `${site}-r1` }] },
                      vault: testVaultWithRelics({ [`${site}-r1`]: RELIC })
                  }
                : {}),
            ...(favor ? { banners: testBanners({ [Banner.PeoplesFavor]: DANA }) } : {})
        }
    )
    openTurn(s, DANA)
    return s
}

const placeSalt = (s: HydratedOathGameState, playerId = DANA, toSiteId?: string) =>
    reasonCannotPlaceCard(s, playerId, SALT, SearchPlay.Site, { toSiteId })

/** The Search route: Salt the Earth kept from Dana's hand and played to a site. */
function searchRefusal(s: HydratedOathGameState, toSiteId?: string) {
    s.getPlayerState(DANA).handIds = [SALT, FILLER]
    return HydratedSearchResolve.reasonCannotResolve(s, DANA, {
        keptCardId: SALT,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        toSiteId
    })
}

/**
 * Land Warden's route: Dana searches the world deck with it, keeps the Wrestlers as a faceup adviser (a denizen kept
 * to c1 would itself be locked there) and plays Salt the Earth second, to their site.
 */
function landWardenRefusal(revision: OathRevision) {
    const s = table(revision, { dana: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } })
    s.requireVault().worldDeck = [INN, SALT, FILLER]
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(LAND_WARDEN)]
        })
    ).apply(s)
    const choice: SearchResolveChoice = {
        keptCardId: FILLER,
        discardOrder: [INN],
        play: SearchPlay.Adviser,
        faceUp: true,
        secondPlay: { cardId: SALT, play: SearchPlay.Site }
    }
    return HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)
}

/** The R-6.1 route: Dana's facedown Salt the Earth played faceup to their site. */
function facedownRefusal(revision: OathRevision) {
    const s = table(revision, { dana: { advisers: [{ cardId: SALT, faceUp: false }] } })
    return HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, {
        cardId: SALT,
        play: SearchPlay.Site
    })
}

describe('Salt the Earth at a site holding only a relic that Ancient Bloodline locks for its player', () => {
    it('from revision 31, Dana is refused at c1, which Rhys rules with Ancient Bloodline', () => {
        expect(placeSalt(table(FIXED))).toBe(REFUSED)
    })

    it('at revision 30, Dana is accepted there, as before', () => {
        expect(placeSalt(table(BEFORE))).toBeUndefined()
    })

    it('control: a denizen Ancient Bloodline locks there still refuses Dana, at revision 31 and before', () => {
        for (const revision of [FIXED, BEFORE]) {
            expect(placeSalt(table(revision, { relic: false, denizens: [WOLVES] }))).toBe(REFUSED)
        }
    })

    it('control: without Ancient Bloodline the relic is not locked, so Dana is accepted', () => {
        expect(placeSalt(table(FIXED, { bloodline: false }))).toBeUndefined()
    })

    it('control: Rhys, who holds Ancient Bloodline, is not its enemy, so Rhys is accepted', () => {
        expect(placeSalt(table(FIXED), RHYS)).toBeUndefined()
    })
})

describe('every route that plays Salt the Earth is refused there from revision 31, and accepted at revision 30', () => {
    it("a Search's kept card to Dana's own site", () => {
        expect(searchRefusal(table(FIXED))).toBe(REFUSED)
        expect(searchRefusal(table(BEFORE))).toBeUndefined()
    })

    it("a Search's kept card to another site, with the People's Favor", () => {
        const at = (revision: OathRevision) => table(revision, { site: 'c2', favor: true })
        expect(searchRefusal(at(FIXED), 'c2')).toBe(REFUSED)
        expect(searchRefusal(at(BEFORE), 'c2')).toBeUndefined()
    })

    it("Land Warden's second card to Dana's own site", () => {
        expect(landWardenRefusal(FIXED)).toBe(`second card: ${REFUSED}`)
        expect(landWardenRefusal(BEFORE)).toBeUndefined()
    })

    it("a facedown adviser played faceup to Dana's own site (R-6.1)", () => {
        expect(facedownRefusal(FIXED)).toBe(REFUSED)
        expect(facedownRefusal(BEFORE)).toBeUndefined()
    })
})

describe("on Dana's own view, where the relic's name and Rhys's hand cannot be read", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    /** The same answer on the server and on Dana's view, and neither changes the state or what Dana is served. */
    function sameOnOwnView(s: HydratedOathGameState, expected: string | undefined) {
        s.getPlayerState(RHYS).handIds = [WOLVES]
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, dana))
        expect(seen).not.toContain(RELIC)
        expect(placeSalt(s)).toBe(expected)
        expect(placeSalt(ownView(s))).toBe(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, dana))).toBe(seen)
    }

    it('from revision 31 the relic Ancient Bloodline locks refuses Dana', () => {
        sameOnOwnView(table(FIXED), REFUSED)
    })

    it('without Ancient Bloodline, and at revision 30, Dana is accepted', () => {
        sameOnOwnView(table(FIXED, { bloodline: false }), undefined)
        sameOnOwnView(table(BEFORE), undefined)
    })
})
