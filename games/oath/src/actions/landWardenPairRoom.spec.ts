import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    reasonCannotPairSecondPlay,
    reasonCannotPlaySecondCard,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { FILLER } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const LAND_WARDEN = 'denizen.hearth.land-warden'
const DAZZLE = 'denizen.arcane.dazzle'
const ROAR = 'denizen.beast.threatening-roar'
const PILGRIMAGE = 'denizen.nomad.pilgrimage'
const WOLVES = 'denizen.beast.wolves'
const BRACKEN = 'denizen.beast.bracken'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle
const NO_ROOM = 'no room at your site for two cards'
const SITE_FULL = 'second card: site c1 is at its capacity of 3'

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

/**
 * Dana at c1 (the Plains, capacity 3) holding `c1` has searched the world deck with Land Warden declared, drawing
 * `kept`, Rangers and a card to discard. Land Warden is Dana's adviser, or, with `wardenAtSite`, a denizen at c1;
 * it is declared unless `declare` is false.
 */
function searched(
    revision: OathRevision,
    kept: string,
    c1: string[],
    { wardenAtSite = false, declare = true }: { wardenAtSite?: boolean; declare?: boolean } = {}
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
                advisers: wardenAtSite ? [] : [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: {
                c1: wardenAtSite ? [LAND_WARDEN, ...c1] : c1,
                c2: [],
                p1: [],
                h1: []
            },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [kept, RANGERS, FILLER]
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: declare ? [modifierUse(LAND_WARDEN)] : []
        })
    ).apply(s)
    return s
}

const rangersSecond = { cardId: RANGERS, play: SearchPlay.Site }

const keptThenRangers = (kept: string): SearchResolveChoice => ({
    keptCardId: kept,
    discardOrder: [FILLER],
    play: SearchPlay.Site,
    secondPlay: rangersSecond
})

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

const pairOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    reasonCannotPairSecondPlay(s, 'dana', choice, rangersSecond)

const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolveOf(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return action
}

const sorted = (ids: readonly string[]) => [...ids].sort()

describe('Land Warden: Dazzle kept to your site discards Longbows, and its space goes to the second card', () => {
    const choice = keptThenRangers(DAZZLE)

    it('setup: the Plains holds Longbows and the Wolves, 2 of its 3', () => {
        const s = searched(FIXED, DAZZLE, [LONGBOWS, WOLVES])
        expect(s.denizensAt('c1')).toEqual([LONGBOWS, WOLVES])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
        expect(reasonCannotPlaySecondCard(s, 'dana', DAZZLE, rangersSecond, choice)).toBeUndefined()
    })

    it('from revision 31: Rangers second fills the last space, accepted, and the Plains ends 3 of 3', () => {
        const s = searched(FIXED, DAZZLE, [LONGBOWS, WOLVES])
        expect(pairOf(s, choice)).toBeUndefined()
        expect(checkOf(s, choice)).toBeUndefined()
        const action = resolveOf(s, choice)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([WOLVES, DAZZLE, RANGERS]))
        expect(action.metadata?.playedCardId).toBe(DAZZLE)
        expect(action.metadata?.secondPlayedCardId).toBe(RANGERS)
        expect(action.metadata?.whenPlayed).toBe('discarded 1 hearth and order cards in the region')
        expect(action.metadata?.favorGained).toBe(2)
        expect(action.metadata?.pileDeposits?.flatMap((deposit) => deposit.cardIds)).toContain(
            LONGBOWS
        )
        expect(action.revealsInfo).toBe(true)
    })

    it('at revision 30: refused for room, as the game was recorded', () => {
        const s = searched(BEFORE, DAZZLE, [LONGBOWS, WOLVES])
        expect(pairOf(s, choice)).toBe(NO_ROOM)
        expect(checkOf(s, choice)).toBe(NO_ROOM)
    })

    it('from revision 31, a kept card that frees nothing at your site: refused for room', () => {
        const s = searched(FIXED, DAZZLE, [WOLVES, BRACKEN])
        expect(pairOf(s, choice)).toBe(NO_ROOM)
        expect(checkOf(s, choice)).toBe(SITE_FULL)
    })
})

describe('Land Warden: a kept card that clears your site leaves it to the second card', () => {
    it('from revision 31: Threatening Roar discards the Wolves, Bracken and itself; Rangers second is accepted and stays', () => {
        const s = searched(FIXED, ROAR, [WOLVES, BRACKEN])
        const choice = keptThenRangers(ROAR)
        expect(pairOf(s, choice)).toBeUndefined()
        expect(checkOf(s, choice)).toBeUndefined()
        resolveOf(s, choice)
        expect(s.denizensAt('c1')).toEqual([RANGERS])
    })

    it('at revision 30, Threatening Roar kept: refused for room, as the game was recorded', () => {
        const s = searched(BEFORE, ROAR, [WOLVES, BRACKEN])
        expect(pairOf(s, keptThenRangers(ROAR))).toBe(NO_ROOM)
        expect(checkOf(s, keptThenRangers(ROAR))).toBe(NO_ROOM)
    })

    it.each([FIXED, BEFORE])(
        'at revision %i, Pilgrimage, an adviser card, moves the full site away; Rangers second to it is accepted and stays',
        (revision) => {
            const s = searched(revision, PILGRIMAGE, [WOLVES, BRACKEN, LONGBOWS])
            const choice: SearchResolveChoice = {
                ...keptThenRangers(PILGRIMAGE),
                play: SearchPlay.Adviser,
                faceUp: true
            }
            expect(pairOf(s, choice)).toBeUndefined()
            expect(checkOf(s, choice)).toBeUndefined()
            resolveOf(s, choice)
            expect(s.denizensAt('c1')).toEqual([RANGERS])
        }
    )
})

describe('Land Warden in use at your site: Dazzle spares it, so it still takes a space', () => {
    const choice = keptThenRangers(DAZZLE)

    it('from revision 31, Land Warden and the Wolves: Dazzle discards nothing, so the pair is refused for room', () => {
        const s = searched(FIXED, DAZZLE, [WOLVES], { wardenAtSite: true })
        expect(pairOf(s, choice)).toBe(NO_ROOM)
        expect(checkOf(s, choice)).toBe(SITE_FULL)
    })

    it('from revision 31, Land Warden and Longbows: Longbows goes, Land Warden stays, and Rangers fills the last space', () => {
        const s = searched(FIXED, DAZZLE, [LONGBOWS], { wardenAtSite: true })
        expect(checkOf(s, choice)).toBeUndefined()
        resolveOf(s, choice)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([LAND_WARDEN, DAZZLE, RANGERS]))
    })
})

describe("Land Warden's pair room on Dana's own view", () => {
    it.each([
        {
            scene: 'Dazzle discarding Longbows, from revision 31',
            revision: FIXED,
            kept: DAZZLE,
            c1: [LONGBOWS, WOLVES],
            expected: undefined
        },
        {
            scene: 'Dazzle freeing nothing, from revision 31',
            revision: FIXED,
            kept: DAZZLE,
            c1: [WOLVES, BRACKEN],
            expected: NO_ROOM
        },
        {
            scene: 'Threatening Roar clearing the site, from revision 31',
            revision: FIXED,
            kept: ROAR,
            c1: [WOLVES, BRACKEN],
            expected: undefined
        },
        {
            scene: 'Dazzle discarding Longbows, at revision 30',
            revision: BEFORE,
            kept: DAZZLE,
            c1: [LONGBOWS, WOLVES],
            expected: NO_ROOM
        }
    ])(
        '$scene: the same answer as on the full state, which is left unchanged',
        ({ revision, kept, c1, expected }) => {
            const s = searched(revision, kept, c1)
            const server = JSON.stringify(s.dehydrate())
            expect(pairOf(ownView(s), keptThenRangers(kept))).toBe(expected)
            expect(checkOf(ownView(s), keptThenRangers(kept))).toBe(
                checkOf(s, keptThenRangers(kept))
            )
            expect(pairOf(s, keptThenRangers(kept))).toBe(expected)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
        }
    )
})

describe("Land Warden's own clauses", () => {
    const INN = 'denizen.hearth.wayside-inn'

    it('undeclared, a second play is refused', () => {
        const s = searched(FIXED, INN, [], { declare: false })
        expect(checkOf(s, keptThenRangers(INN))).toMatch(/only one drawn card/)
    })

    it('"may": declared, one card played and the rest discarded is accepted', () => {
        const s = searched(FIXED, INN, [])
        expect(
            checkOf(s, { keptCardId: INN, discardOrder: [RANGERS, FILLER], play: SearchPlay.Site })
        ).toBeUndefined()
    })

    it('"if you play at least one card to a site": two advisers are refused', () => {
        const s = searched(FIXED, INN, [])
        expect(
            checkOf(s, {
                keptCardId: INN,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: true,
                secondPlay: { cardId: RANGERS, play: SearchPlay.Adviser, faceUp: true }
            })
        ).toMatch(/at least one/)
    })

    it('one to the site and one facedown adviser is accepted, and each lands', () => {
        const s = searched(FIXED, INN, [])
        const choice: SearchResolveChoice = {
            keptCardId: INN,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            secondPlay: { cardId: RANGERS, play: SearchPlay.Adviser, faceUp: false }
        }
        expect(checkOf(s, choice)).toBeUndefined()
        resolveOf(s, choice)
        expect(s.denizensAt('c1')).toEqual([INN])
        expect(s.getPlayerState('dana').knownAdviserIds()).toContain(RANGERS)
    })

    it('the cost, one favor placed on Land Warden', () => {
        const s = searched(FIXED, INN, [])
        expect(s.getPlayerState('dana').favor).toBe(2)
    })
})
