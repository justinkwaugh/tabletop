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
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { card, modifierUse } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { discardFirstReach, playMapChanges } from '../util/cardPlay.js'
import { OathRevision } from '../util/revision.js'
import { searchPlayModifiers } from '../util/modifiers.js'
import '../powers/index.js'

// Crop Rotation: "If playing to a site, you may discard a denizen there first." Its Q&A: may it be used along with
// the Banner of the People's Favor? "Yup!" The People's Favor lets its holder first discard a card from any site in
// their region (R-5.1.4.I), and the Great Slum lets a play to it discard a card there first (R-11.10). Each power
// gives its own card discarded first, so with two of them two cards may go, each meeting its own power's rule. From
// revision 32; before it, a game keeps the one card it was recorded with.

const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const ALCHEMIST = 'denizen.arcane.alchemist'
const CAPTAINS = 'denizen.order.captains'
const WOLVES = 'denizen.beast.wolves'
const SONGS = 'denizen.hearth.tavern-songs'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const GAMBLING_HALL = 'denizen.discord.gambling-hall'
const BOILING_LAKE = 'denizen.discord.boiling-lake'
const SALT = 'denizen.discord.salt-the-earth'
const LONGBOWS = 'denizen.order.longbows'
const HERD = 'denizen.nomad.great-herd'
const ORACLE = 'denizen.nomad.oracle'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26
const UNMATCHED =
    'one card is discarded first for each power that gives one, each as that power allows'
const BEFORE_LIST = 'in a game created before revision 32, at most one card is discarded first'

interface Table {
    revision?: OathRevision
    /** The denizens at c1, Dana's site. */
    c1?: string[]
    /** c1's site card. */
    site?: string
    /** The denizens at c2, the River, in Dana's region. */
    c2?: string[]
    /** Dana holds the People's Favor. */
    favor?: boolean
    /** Dana has Crop Rotation faceup as an adviser and uses it on the Search. */
    crop?: boolean
    /** Dana has Land Warden faceup as an adviser and uses it on the Search. */
    warden?: boolean
    /** The denizens at h1, in the Hinterland. */
    h1?: string[]
    /** The world deck's top three. */
    top?: string[]
}

/**
 * Dana (Exile) at c1 (the Plains, capacity 3, holding the Wolves and the Tents unless `c1` says), with the River
 * (c2, capacity 2) holding the Rowdy Pub and the Gambling Hall. Rhys is at the River. Dana has searched the world
 * deck, drawing Alchemist, Wrestlers and Captains (`top` replaces them).
 */
function searched({
    revision = FIXED,
    c1 = [WOLVES, TENTS],
    site = 'site.plains',
    c2 = [ROWDY_PUB, GAMBLING_HALL],
    h1 = [],
    favor = true,
    crop = true,
    warden = false,
    top = [ALCHEMIST, FILLER, CAPTAINS]
}: Table = {}): HydratedOathGameState {
    const uses = [...(crop ? [CROP_ROTATION] : []), ...(warden ? [LAND_WARDEN] : [])]
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: uses.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2, p1: [], h1 },
            siteCards: { c1: site, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...(favor ? { banners: testBanners({ [Banner.PeoplesFavor]: DANA }) } : {})
        }
    )
    openTurn(s, DANA)
    s.requireVault().worldDeck = top
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: uses.map((cardId) => modifierUse(cardId))
        })
    ).apply(s)
    return s
}

/** Alchemist kept and played to Dana's site, discarding `firsts` first. */
function kept(
    firsts: readonly string[],
    more: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId: ALCHEMIST,
        discardOrder: [FILLER, CAPTAINS],
        play: SearchPlay.Site,
        ...(firsts.length === 1 ? { discardFirstCardId: firsts[0] } : {}),
        ...(firsts.length > 1 ? { discardFirstCardIds: [...firsts] } : {}),
        ...more
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

function resolveOf(s: HydratedOathGameState, choice: SearchResolveChoice) {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: DANA, ...choice })
    )
    action.apply(s)
    return action
}

describe("one card discarded first per power that gives one: Crop Rotation with the People's Favor", () => {
    it('two powers: the Tents at the Plains and the Rowdy Pub at the River, accepted in either order, and both go', () => {
        for (const firsts of [
            [TENTS, ROWDY_PUB],
            [ROWDY_PUB, TENTS]
        ]) {
            const s = searched()
            expect(checkOf(s, kept(firsts))).toBeUndefined()
            resolveOf(s, kept(firsts))
            expect(s.denizensAt('c1')).toEqual([WOLVES, ALCHEMIST])
            expect(s.denizensAt('c2')).toEqual([GAMBLING_HALL])
        }
    })

    it('applied: both leave the map, Alchemist joins the Plains, and both are recorded as discarded', () => {
        const s = searched()
        const action = resolveOf(s, kept([TENTS, ROWDY_PUB]))
        expect(s.denizensAt('c1')).toEqual([WOLVES, ALCHEMIST])
        expect(s.denizensAt('c2')).toEqual([GAMBLING_HALL])
        expect(action.discardFirstCardIds).toEqual([TENTS, ROWDY_PUB])
        expect(action.metadata?.discardedCardIds).toEqual(
            expect.arrayContaining([FILLER, CAPTAINS, TENTS, ROWDY_PUB])
        )
    })

    it('both at the Plains: one for Crop Rotation and one for the People’s Favor, accepted', () => {
        const s = searched()
        expect(checkOf(s, kept([WOLVES, TENTS]))).toBeUndefined()
        resolveOf(s, kept([WOLVES, TENTS]))
        expect(s.denizensAt('c1')).toEqual([ALCHEMIST])
    })

    it("both at the River: Crop Rotation's card must be at the site played to, refused", () => {
        expect(checkOf(searched(), kept([ROWDY_PUB, GAMBLING_HALL]))).toBe(UNMATCHED)
    })

    it('a third card: refused, as only two powers give one', () => {
        expect(checkOf(searched(), kept([WOLVES, TENTS, ROWDY_PUB]))).toBe(UNMATCHED)
    })

    it('one card named twice: refused', () => {
        expect(checkOf(searched(), kept([TENTS, TENTS]))).toBe('a card is discarded first once')
    })

    it("two from one power: the People's Favor alone, or Crop Rotation alone, refused", () => {
        expect(checkOf(searched({ crop: false }), kept([TENTS, ROWDY_PUB]))).toBe(UNMATCHED)
        expect(checkOf(searched({ favor: false }), kept([WOLVES, TENTS]))).toBe(UNMATCHED)
    })

    it('each card is judged on its own too: a locked card among them is refused', () => {
        const s = searched({ c1: [BOILING_LAKE, TENTS] })
        expect(checkOf(s, kept([TENTS, BOILING_LAKE]))).toBe(
            `${BOILING_LAKE} is locked and cannot be discarded`
        )
    })

    it('the list and the one card together: refused', () => {
        expect(checkOf(searched(), kept([TENTS, ROWDY_PUB], { discardFirstCardId: WOLVES }))).toBe(
            'the cards discarded first are named once: a list or one card'
        )
    })

    it('a full Plains: the Rowdy Pub alone opens nothing, with the Tents it opens the play', () => {
        const s = searched({ c1: [WOLVES, TENTS, SONGS] })
        expect(checkOf(s, kept([ROWDY_PUB]))).toBe('site c1 is at its capacity of 3')
        expect(checkOf(s, kept([ROWDY_PUB, TENTS]))).toBeUndefined()
    })

    it('one card still works as before: the Tents alone, sent as one card', () => {
        const s = searched()
        expect(checkOf(s, kept([TENTS]))).toBeUndefined()
        resolveOf(s, kept([TENTS]))
        expect(s.denizensAt('c1')).toEqual([WOLVES, ALCHEMIST])
    })

    it('the plan lists both cards as leaving, and both give back what they hold', () => {
        const s = searched()
        const changes = playMapChanges(s, DANA, ALCHEMIST, SearchPlay.Site, {
            discardFirstCardIds: [TENTS, ROWDY_PUB]
        })
        expect(changes.leaving).toEqual([TENTS, ROWDY_PUB])
        expect(changes.gains?.returning).toEqual([TENTS, ROWDY_PUB])
    })

    it('the offer: the cards some power reaches, and two may go', () => {
        const s = searched()
        const reach = discardFirstReach(s, DANA, {
            carried: searchPlayModifiers(s)
        })
        expect(reach).toEqual({ cardIds: [WOLVES, TENTS, ROWDY_PUB, GAMBLING_HALL], most: 2 })
        expect(discardFirstReach(searched({ crop: false }), DANA, {}).most).toBe(1)
    })

    it("the check runs on Dana's own view as on the full state, and copies nothing", () => {
        const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
        const s = searched()
        const server = JSON.stringify(s.dehydrate())
        const own = OathVisibility.state.guardForExecution(
            new HydratedOathGameState(served(s, dana)),
            dana
        )
        expect(checkOf(own, kept([TENTS, ROWDY_PUB]))).toBeUndefined()
        expect(checkOf(own, kept([ROWDY_PUB, GAMBLING_HALL]))).toBe(UNMATCHED)
        expect(discardFirstReach(own, DANA, { carried: searchPlayModifiers(own) })).toEqual(
            discardFirstReach(s, DANA, { carried: searchPlayModifiers(s) })
        )
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})

describe('one card discarded first per power: the Great Slum with Crop Rotation', () => {
    // Fresh lists for each table: the play changes the ones it is given.
    const slum = (): Table => ({
        site: 'site.great-slums',
        c1: [WOLVES, TENTS, SONGS],
        favor: false
    })

    it('two cards at the Great Slum: accepted', () => {
        const s = searched(slum())
        expect(checkOf(s, kept([WOLVES, TENTS]))).toBeUndefined()
        resolveOf(s, kept([WOLVES, TENTS]))
        expect(s.denizensAt('c1')).toEqual([SONGS, ALCHEMIST])
    })

    it('three cards there: refused', () => {
        expect(checkOf(searched(slum()), kept([WOLVES, TENTS, SONGS]))).toBe(UNMATCHED)
    })

    it('all three powers: the Great Slum, Crop Rotation and the People’s Favor, three cards accepted', () => {
        const s = searched({ ...slum(), favor: true })
        expect(checkOf(s, kept([WOLVES, TENTS, ROWDY_PUB]))).toBeUndefined()
        expect(checkOf(s, kept([WOLVES, TENTS, SONGS]))).toBeUndefined()
    })
})

describe('one card discarded first per power: the Homeland ledger once per card', () => {
    // The Fertile Valley (Homeland: a Hearth card played here gains a favor, unless a Hearth card was discarded
    // here this turn). The Inn is Hearth.
    const valley = (): Table => ({
        site: 'site.fertile-valley',
        c1: [WOLVES, SONGS],
        top: [INN, FILLER, CAPTAINS]
    })
    const favorOf = (s: HydratedOathGameState) => s.getPlayerState(DANA).favor
    const inn = (firsts: readonly string[]): SearchResolveChoice => ({
        ...kept(firsts),
        keptCardId: INN,
        discardOrder: [FILLER, CAPTAINS]
    })

    it('the Wolves and the Rowdy Pub first: both go, no Hearth card left the Valley, so the Homeland pays', () => {
        const s = searched(valley())
        const before = favorOf(s)
        resolveOf(s, inn([WOLVES, ROWDY_PUB]))
        expect(s.denizensAt('c1')).toEqual([SONGS, INN])
        expect(s.denizensAt('c2')).toEqual([GAMBLING_HALL])
        expect(favorOf(s) - before).toBe(2)
        expect(s.getPlayerState(DANA).homelandUsedThisTurn).toEqual(
            expect.arrayContaining(['c1:beast', 'c2:hearth'])
        )
    })

    it('the Wolves and Tavern Songs first: Tavern Songs is Hearth, discarded at the Valley, so it does not', () => {
        const s = searched(valley())
        const planned = playMapChanges(s, DANA, INN, SearchPlay.Site, {
            discardFirstCardIds: [WOLVES, SONGS]
        })
        const before = favorOf(s)
        resolveOf(s, inn([WOLVES, SONGS]))
        expect(favorOf(s) - before).toBe(1)
        expect(planned.gains?.favorTaken).toHaveLength(1)
        expect(s.getPlayerState(DANA).homelandUsedThisTurn).toEqual(
            expect.arrayContaining(['c1:beast', 'c1:hearth'])
        )
    })
})

describe('one card discarded first per power: Land Warden and Salt the Earth', () => {
    it('Land Warden: the kept card discards two first at a full Plains, so both cards fit; one is not enough', () => {
        const s = searched({
            c1: [WOLVES, TENTS, SONGS],
            warden: true,
            top: [ALCHEMIST, LONGBOWS, CAPTAINS]
        })
        const pair = (firsts: readonly string[]): SearchResolveChoice => ({
            ...kept(firsts),
            discardOrder: [CAPTAINS],
            secondPlay: { cardId: LONGBOWS, play: SearchPlay.Site }
        })
        const second = { cardId: LONGBOWS, play: SearchPlay.Site }
        expect(reasonCannotPairSecondPlay(s, DANA, pair([WOLVES, TENTS]), second)).toBeUndefined()
        expect(reasonCannotPairSecondPlay(s, DANA, pair([WOLVES]), second)).toBe(
            'no room at your site for two cards'
        )
        expect(checkOf(s, pair([WOLVES, TENTS]))).toBeUndefined()
        resolveOf(s, pair([WOLVES, TENTS]))
        expect(s.denizensAt('c1')).toEqual([SONGS, ALCHEMIST, LONGBOWS])
    })

    it('Salt the Earth kept with two cards first: each is judged, and two from the River refused', () => {
        const s = searched({ top: [SALT, FILLER, CAPTAINS] })
        const salt = (firsts: readonly string[]) => ({ ...kept(firsts), keptCardId: SALT })
        expect(checkOf(s, salt([TENTS, ROWDY_PUB]))).toBeUndefined()
        expect(checkOf(s, salt([ROWDY_PUB, GAMBLING_HALL]))).toBe(UNMATCHED)
    })
})

describe('one card discarded first per power: the facedown adviser play', () => {
    /** Dana also has Alchemist facedown as an adviser, and plays it faceup to their site using Crop Rotation. */
    function facedown(firsts: readonly string[]) {
        const s = searched()
        s.getPlayerState(DANA).addAdviser(ALCHEMIST, false)
        const choice = {
            cardId: ALCHEMIST,
            play: SearchPlay.Site,
            ...(firsts.length > 1 ? { discardFirstCardIds: [...firsts] } : {}),
            modifiers: [modifierUse(CROP_ROTATION)]
        }
        return { s, choice }
    }

    it('two powers: accepted and applied; two at the River refused', () => {
        const { s, choice } = facedown([TENTS, ROWDY_PUB])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, choice)).toBeUndefined()
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, {
                ...choice,
                discardFirstCardIds: [ROWDY_PUB, GAMBLING_HALL]
            })
        ).toBe(UNMATCHED)
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: DANA, ...choice })
        ).apply(s)
        expect(s.denizensAt('c1')).toEqual([WOLVES, ALCHEMIST])
        expect(s.denizensAt('c2')).toEqual([GAMBLING_HALL])
    })
})

describe('before revision 32 a game keeps the one card discarded first it was recorded with', () => {
    it('the list is refused, two cards or one', () => {
        const s = searched({ revision: BEFORE })
        expect(checkOf(s, kept([TENTS, ROWDY_PUB]))).toBe(BEFORE_LIST)
        expect(checkOf(s, { ...kept([]), discardFirstCardIds: [TENTS] })).toBe(BEFORE_LIST)
        expect(discardFirstReach(s, DANA, { carried: searchPlayModifiers(s) }).most).toBe(1)
    })

    it('one card behaves as today', () => {
        const s = searched({ revision: BEFORE })
        expect(checkOf(s, kept([ROWDY_PUB]))).toBeUndefined()
        resolveOf(s, kept([ROWDY_PUB]))
        expect(s.denizensAt('c1')).toEqual([WOLVES, TENTS, ALCHEMIST])
        expect(s.denizensAt('c2')).toEqual([GAMBLING_HALL])
    })
})

describe("one card discarded first per power: Great Herd's swap after the play", () => {
    /** Great Herd kept and played to Dana's site, discarding `firsts` first, then swapping by `choices`. */
    const herd = (firsts: readonly string[], ...choices: string[]): SearchResolveChoice => ({
        ...kept(firsts),
        keptCardId: HERD,
        choices: choices.map((cardId) => card(cardId))
    })
    const herdTable = (more: Table = {}): Table => ({
        h1: [ORACLE],
        top: [HERD, FILLER, CAPTAINS],
        ...more
    })

    it('neither card discarded first can be the card it swaps with; another Nomad card can', () => {
        const s = searched(herdTable())
        expect(checkOf(s, herd([TENTS, ROWDY_PUB], TENTS))).toBe(
            `${TENTS} is discarded before Great Herd is played, so it is no longer at a site`
        )
        expect(checkOf(s, herd([TENTS, ROWDY_PUB], ORACLE))).toBeUndefined()
        resolveOf(s, herd([TENTS, ROWDY_PUB], ORACLE))
        expect(s.denizensAt('c1')).toEqual([WOLVES, ORACLE])
        expect(s.denizensAt('h1')).toEqual([HERD])
    })

    it("at the Great Slum, the swap's own card discarded first is never one the play discarded first", () => {
        const s = searched(
            herdTable({ site: 'site.great-slums', c1: [WOLVES, TENTS, SONGS], favor: false })
        )
        expect(checkOf(s, herd([WOLVES, TENTS], ORACLE, WOLVES))).toMatch(
            /is not among the options/
        )
        expect(checkOf(s, herd([WOLVES, TENTS], ORACLE, SONGS))).toBeUndefined()
        resolveOf(s, herd([WOLVES, TENTS], ORACLE, SONGS))
        expect(s.denizensAt('c1')).toEqual([ORACLE])
        expect(s.denizensAt('h1')).toEqual([HERD])
    })
})
