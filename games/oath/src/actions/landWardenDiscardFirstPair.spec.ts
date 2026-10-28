import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    reasonCannotPairSecondPlay,
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

// Land Warden plays the kept card first, then the second card. Law 5.1.4.I: with the People's Favor "you may first
// discard a card from any site in your region"; the Great Slum: "When playing or moving a card to this site, you may
// discard a card here first." Land Warden's Q&A lets both plays use the People's Favor. So a card the kept card
// discards first at your site leaves its space to the second card.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const SALT = 'denizen.discord.salt-the-earth'
const BOILING_LAKE = 'denizen.discord.boiling-lake'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const STORYTELLER = 'denizen.hearth.storyteller'
const LONGBOWS = 'denizen.order.longbows'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'

const FIXED = OathRevision.EngineFixes25
const BEFORE = OathRevision.EngineFixes24

/**
 * Dana holds Land Warden at c1 (the Plains, capacity 3, unless `site` names another) and has searched the world
 * deck with it, drawing the Inn, Longbows and a card to discard (`top` replaces them). With `favor`, Dana also
 * holds the People's Favor; the River (c2) is in the same region. With `crop`, Dana also has Crop Rotation as an
 * adviser and uses it on the Search.
 */
function searched(
    revision: OathRevision,
    {
        c1 = [] as string[],
        c2 = [] as string[],
        favor = false,
        crop = false,
        site = 'site.plains',
        top = [INN, LONGBOWS, FILLER]
    } = {}
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
                advisers: [LAND_WARDEN, ...(crop ? [CROP_ROTATION] : [])].map((cardId) => ({
                    cardId,
                    faceUp: true
                }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2, p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: site,
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
            modifiers: [modifierUse(LAND_WARDEN), ...(crop ? [modifierUse(CROP_ROTATION)] : [])]
        })
    ).apply(s)
    return s
}

/** The Inn kept to Dana's site, discarding `first` first; `second` played to Dana's site; the filler discarded. */
function innFirst(
    first: string | undefined,
    second = LONGBOWS,
    kept: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId: INN,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        ...(first !== undefined ? { discardFirstCardId: first } : {}),
        ...kept,
        secondPlay: { cardId: second, play: SearchPlay.Site }
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

function resolveOf(s: HydratedOathGameState, choice: SearchResolveChoice) {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return action
}

const sorted = (ids: readonly string[]) => [...ids].sort()
const TWO_OF_THREE = [WOLVES, RANGERS]
const FULL = [WOLVES, RANGERS, STORYTELLER]
const PLAINS_WITH_FAVOR = { c1: TWO_OF_THREE, favor: true }
const GREAT_SLUM = { c1: TWO_OF_THREE, site: 'site.great-slums' }
const CROP = { c1: TWO_OF_THREE, crop: true }

describe("Land Warden from revision 29: the kept card's card discarded first at your site leaves room for the second card", () => {
    it('setup: the Plains and the Great Slum each hold 2 of their 3', () => {
        for (const options of [PLAINS_WITH_FAVOR, GREAT_SLUM]) {
            const s = searched(FIXED, options)
            expect(effectiveSiteCapacity(s, 'c1')).toBe(3)
            expect(s.denizensAt('c1')).toHaveLength(2)
        }
    })

    it("the People's Favor: the Inn discards the Wolves first, Longbows second fills the last space: accepted, and the Plains ends 3 of 3", () => {
        const s = searched(FIXED, PLAINS_WITH_FAVOR)
        expect(checkOf(s, innFirst(WOLVES))).toBeUndefined()
        resolveOf(s, innFirst(WOLVES))
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([RANGERS, INN, LONGBOWS]))
        expect(s.denizensAt('c1')).toHaveLength(effectiveSiteCapacity(s, 'c1'))
    })

    it('the Great Slum: the Inn discards the Wolves there first, Longbows second fills the last space: accepted, 3 of 3', () => {
        const s = searched(FIXED, GREAT_SLUM)
        expect(checkOf(s, innFirst(WOLVES))).toBeUndefined()
        resolveOf(s, innFirst(WOLVES))
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([RANGERS, INN, LONGBOWS]))
        expect(s.denizensAt('c1')).toHaveLength(effectiveSiteCapacity(s, 'c1'))
    })

    it('Crop Rotation: the Inn discards the Wolves first, Longbows second fills the last space: accepted, 3 of 3', () => {
        const s = searched(FIXED, CROP)
        expect(checkOf(s, innFirst(WOLVES))).toBeUndefined()
        resolveOf(s, innFirst(WOLVES))
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([RANGERS, INN, LONGBOWS]))
        expect(s.denizensAt('c1')).toHaveLength(effectiveSiteCapacity(s, 'c1'))
    })

    it("the pair check alone counts the kept card's discard first at your site", () => {
        const s = searched(FIXED, PLAINS_WITH_FAVOR)
        const second = { cardId: LONGBOWS, play: SearchPlay.Site }
        expect(
            reasonCannotPairSecondPlay(s, 'dana', SearchPlay.Site, second, undefined, WOLVES)
        ).toBeUndefined()
        expect(reasonCannotPairSecondPlay(s, 'dana', SearchPlay.Site, second)).toBe(
            'no room at your site for two cards'
        )
    })

    it("control: the Inn alone, discarding the Wolves first with the People's Favor, is accepted", () => {
        const s = searched(FIXED, PLAINS_WITH_FAVOR)
        expect(
            checkOf(s, {
                keptCardId: INN,
                discardOrder: [FILLER, LONGBOWS],
                play: SearchPlay.Site,
                discardFirstCardId: WOLVES
            })
        ).toBeUndefined()
    })

    it('control: with no card discarded first, the pair is still refused at 2 of 3', () => {
        for (const options of [PLAINS_WITH_FAVOR, GREAT_SLUM, CROP]) {
            expect(checkOf(searched(FIXED, options), innFirst(undefined))).toBe(
                'second card: site c1 is at its capacity of 3'
            )
        }
    })

    it("control: a card the People's Favor discards first at another site frees no space at yours: refused", () => {
        const s = searched(FIXED, { ...PLAINS_WITH_FAVOR, c2: [STORYTELLER] })
        expect(checkOf(s, innFirst(STORYTELLER))).toBe(
            'second card: site c1 is at its capacity of 3'
        )
        expect(
            reasonCannotPairSecondPlay(
                s,
                'dana',
                SearchPlay.Site,
                { cardId: LONGBOWS, play: SearchPlay.Site },
                undefined,
                STORYTELLER
            )
        ).toBe('no room at your site for two cards')
    })

    it('a full site: the Inn discards the Wolves first and fills it, so Longbows second is refused', () => {
        const s = searched(FIXED, { c1: FULL, favor: true })
        expect(checkOf(s, innFirst(WOLVES))).toBe('second card: site c1 is at its capacity of 3')
    })

    it('a locked card cannot be discarded first, so the pair is refused', () => {
        const s = searched(FIXED, { c1: [BOILING_LAKE, WOLVES], favor: true })
        expect(checkOf(s, innFirst(BOILING_LAKE))).toBe(
            `${BOILING_LAKE} is locked and cannot be discarded`
        )
    })

    it('Salt the Earth second after the Inn discards the Wolves first: accepted, and Salt the Earth is left alone there', () => {
        const s = searched(FIXED, { ...PLAINS_WITH_FAVOR, top: [INN, SALT, FILLER] })
        expect(checkOf(s, innFirst(WOLVES, SALT))).toBeUndefined()
        resolveOf(s, innFirst(WOLVES, SALT))
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
    })

    it('the resolve records the discard first and both plays, and shows both cards, so it cannot be undone', () => {
        const s = searched(FIXED, PLAINS_WITH_FAVOR)
        const action = resolveOf(s, innFirst(WOLVES))
        expect(action.discardFirstCardId).toBe(WOLVES)
        expect(action.metadata?.playedCardId).toBe(INN)
        expect(action.metadata?.secondPlayedCardId).toBe(LONGBOWS)
        expect(action.metadata?.favorGained).toBe(2)
        expect(action.metadata?.discardedCardIds).toEqual([FILLER, WOLVES])
        expect(s.denizensAt('c1')).not.toContain(WOLVES)
        expect(action.revealsInfo).toBe(true)
    })

    it("the check runs on Dana's own view as on the full state, and copies nothing", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        for (const options of [PLAINS_WITH_FAVOR, GREAT_SLUM]) {
            const s = searched(FIXED, options)
            const server = JSON.stringify(s.dehydrate())
            const own = OathVisibility.state.guardForExecution(
                new HydratedOathGameState(served(s, dana)),
                dana
            )
            expect(checkOf(own, innFirst(WOLVES))).toBeUndefined()
            expect(checkOf(own, innFirst(undefined))).toBe(checkOf(s, innFirst(undefined)))
            expect(JSON.stringify(s.dehydrate())).toBe(server)
        }
    })

    it('before revision 29 a game keeps the check it was recorded with: the pair is refused for room', () => {
        for (const options of [PLAINS_WITH_FAVOR, GREAT_SLUM, CROP]) {
            expect(checkOf(searched(BEFORE, options), innFirst(WOLVES))).toBe(
                'no room at your site for two cards'
            )
        }
    })
})

// The kept card discards first at your site and is played to another site (the People's Favor): the second card's
// own check reads your site as the kept play leaves it (revision 29), so it has the space the discard freed.
describe('Land Warden from revision 29: the kept card discards first at your site and goes to another; the second card takes the space', () => {
    const toRiver = innFirst(WOLVES, LONGBOWS, { toSiteId: 'c2' })

    it('control: the Inn alone, discarding the Wolves at your full site and going to the River, is accepted', () => {
        const s = searched(FIXED, { c1: FULL, favor: true })
        expect(
            checkOf(s, {
                keptCardId: INN,
                discardOrder: [FILLER, LONGBOWS],
                play: SearchPlay.Site,
                discardFirstCardId: WOLVES,
                toSiteId: 'c2'
            })
        ).toBeUndefined()
    })

    it('Longbows second to your site after the Wolves were discarded there: accepted, and each site holds its card', () => {
        const s = searched(FIXED, { c1: FULL, favor: true })
        expect(checkOf(s, toRiver)).toBeUndefined()
        resolveOf(s, toRiver)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([RANGERS, STORYTELLER, LONGBOWS]))
        expect(s.denizensAt('c2')).toEqual([INN])
    })

    it("on Dana's own view, the same answer", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const s = searched(FIXED, { c1: FULL, favor: true })
        const own = OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, dana)),
            dana
        )
        expect(checkOf(own, toRiver)).toBeUndefined()
    })

    it('before revision 29 the second card is judged on your site as it stood: refused', () => {
        const s = searched(BEFORE, { c1: FULL, favor: true })
        expect(checkOf(s, toRiver)).toBe('second card: site c1 is at its capacity of 3')
    })
})
