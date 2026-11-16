import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { Banner, CardKind, Region } from '../model/oathEnums.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, region } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law, Glossary, "Discard": "If discarding cards in a different region from your pawn, discard based on the
// region of the card instead." A card discarded in a region goes to the next region's pile (Cradle to Provinces,
// Provinces to Hinterland, Hinterland to Cradle). A card discarded first before a site play (the Great Slum, Crop
// Rotation, the People's Favor) at a site in another region than the pawn's, as New Growth allows, goes by its
// own site's region from revision 33. Before it, a game keeps the pile of the pawn's region it was recorded with.

const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const BRACKEN = 'denizen.beast.bracken'
const CRACKED_HORN = 'relic.cracked-horn'
const SCOUTS = 'denizen.order.scouts'
const LONGBOWS = 'denizen.order.longbows'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const GREAT_SLUM = 'site.great-slums'

const DANA = 'dana'
const RHYS = 'rhys'
const FIXED = OathRevision.EngineFixes28
const BEFORE = [OathRevision.EngineFixes27, OathRevision.EngineFixes26]

const SITE_REGION: Record<string, Region> = {
    c1: Region.Cradle,
    c2: Region.Cradle,
    p1: Region.Provinces,
    h1: Region.Hinterland
}
const NEXT: Record<Region, Region> = {
    [Region.Cradle]: Region.Provinces,
    [Region.Provinces]: Region.Hinterland,
    [Region.Hinterland]: Region.Cradle
}

interface Table {
    revision?: OathRevision
    /** Dana's site. */
    pawn?: string
    denizensBySite?: Record<string, string[]>
    siteCards?: Record<string, string>
    /** Dana's faceup advisers. */
    advisers?: string[]
    /** Dana's relics. */
    relics?: string[]
    /** The Search's modifiers; by default each of Dana's advisers. */
    uses?: ModifierUse[]
    /** Dana holds the People's Favor. */
    favor?: boolean
}

/** Dana (Exile) at `pawn`, Rhys at c2. Nothing has been drawn. */
function table({
    revision = FIXED,
    pawn = 'c1',
    denizensBySite = {},
    siteCards,
    advisers = [],
    relics = [],
    favor = false
}: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: pawn,
                favor: 3,
                relicIds: relics,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c2', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizensBySite },
            warbandsBySite: { [pawn]: { [DANA]: 1 } },
            ...(siteCards
                ? {
                      siteCards: {
                          c1: 'site.river',
                          c2: 'site.river',
                          p1: 'site.plains',
                          h1: 'site.mountain',
                          ...siteCards
                      }
                  }
                : {}),
            ...(favor ? { banners: testBanners({ [Banner.PeoplesFavor]: DANA }) } : {})
        }
    )
    openTurn(s, DANA)
    return s
}

/** Dana has searched the world deck, drawing the Inn and two others. */
function searched(t: Table): HydratedOathGameState {
    const s = table(t)
    s.requireVault().worldDeck = [INN, FILLER, FILLER]
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: t.uses ?? (t.advisers ?? []).map((id) => modifierUse(id))
        })
    ).apply(s)
    return s
}

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    expect(HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)).toBeUndefined()
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: DANA, ...choice })
    )
    action.apply(s)
    return action
}

/** The Inn to `toSiteId` by New Growth, discarding `firsts` first; one card is sent alone, as before revision 32. */
function innTo(toSiteId: string, firsts: readonly string[]): SearchResolveChoice {
    return {
        keptCardId: INN,
        discardOrder: [FILLER, FILLER],
        play: SearchPlay.Site,
        toSiteId,
        ...(firsts.length === 1 ? { discardFirstCardId: firsts[0] } : {}),
        ...(firsts.length > 1 ? { discardFirstCardIds: [...firsts] } : {})
    }
}

/** Each pile's cards, top first. */
const piles = (s: HydratedOathGameState) => s.requireVault().discardPiles

function counts(cradle: number, provinces: number, hinterland: number) {
    return {
        [Region.Cradle]: cradle,
        [Region.Provinces]: provinces,
        [Region.Hinterland]: hinterland
    }
}

/** New Growth and Crop Rotation: the Inn to p1 (the Marshes, Provinces), Scouts discarded first there. */
const cropRotation = (revision: OathRevision = FIXED) =>
    searched({
        revision,
        denizensBySite: { p1: [SCOUTS, TENTS, LONGBOWS] },
        advisers: [NEW_GROWTH, CROP_ROTATION]
    })

/** New Growth: the Inn to p1, a Great Slum in the Provinces, Scouts discarded first there. */
const greatSlum = (revision: OathRevision = FIXED) =>
    searched({
        revision,
        denizensBySite: { p1: [SCOUTS, TENTS, LONGBOWS] },
        siteCards: { p1: GREAT_SLUM },
        advisers: [NEW_GROWTH]
    })

describe('Law, Discard: a card discarded first at a site in another region goes by its own region (revision 33)', () => {
    it('New Growth and Crop Rotation: Scouts at p1 (Provinces) go to the Hinterland pile, the Search’s two to the Provinces pile', () => {
        const s = cropRotation()
        const action = resolve(s, innTo('p1', [SCOUTS]))
        expect(s.denizensAt('p1')).toEqual([TENTS, LONGBOWS, INN])
        expect(s.discardPileCounts).toEqual(counts(0, 2, 1))
        expect(piles(s)).toEqual({
            [Region.Cradle]: [],
            [Region.Provinces]: [FILLER, FILLER],
            [Region.Hinterland]: [SCOUTS]
        })
        expect(s.discardTopBackType?.[Region.Hinterland]).toBe(CardKind.Denizen)
        expect(action.metadata).toMatchObject({
            discardedCardIds: [FILLER, FILLER],
            discardedCount: 2,
            discardPileRegion: Region.Provinces,
            pileDeposits: [{ region: Region.Hinterland, cardIds: [SCOUTS] }]
        })
    })

    it('New Growth to a Great Slum at p1: Scouts discarded first there go to the Hinterland pile', () => {
        const s = greatSlum()
        resolve(s, innTo('p1', [SCOUTS]))
        expect(s.denizensAt('p1')).toEqual([TENTS, LONGBOWS, INN])
        expect(s.discardPileCounts).toEqual(counts(0, 2, 1))
        expect(piles(s)[Region.Hinterland]).toEqual([SCOUTS])
    })

    it('every pair of regions: the Search’s discards by the pawn’s region, the card discarded first by its site’s', () => {
        const pairs = [
            ['c1', 'p1'],
            ['c1', 'h1'],
            ['p1', 'c1'],
            ['p1', 'h1'],
            ['h1', 'c1'],
            ['h1', 'p1']
        ]
        for (const [pawn, to] of pairs) {
            const s = searched({
                pawn,
                denizensBySite: { [to]: [SCOUTS] },
                siteCards: { [to]: GREAT_SLUM },
                advisers: [NEW_GROWTH]
            })
            resolve(s, innTo(to, [SCOUTS]))
            const searchPile = NEXT[SITE_REGION[pawn]]
            const firstPile = NEXT[SITE_REGION[to]]
            expect(s.denizensAt(to), `${pawn} to ${to}`).toEqual([INN])
            expect(piles(s)[searchPile], `${pawn} to ${to}`).toEqual([FILLER, FILLER])
            expect(piles(s)[firstPile], `${pawn} to ${to}`).toEqual([SCOUTS])
            expect(s.discardPileCounts[searchPile]).toBe(2)
            expect(s.discardPileCounts[firstPile]).toBe(1)
        }
    })

    it("the People's Favor with New Growth and Crop Rotation: two at p1's Great Slum go to the Hinterland pile, one at c2 to the Provinces pile", () => {
        const s = searched({
            denizensBySite: { c2: [ROWDY_PUB], p1: [SCOUTS, TENTS, LONGBOWS] },
            siteCards: { p1: GREAT_SLUM },
            advisers: [NEW_GROWTH, CROP_ROTATION],
            favor: true
        })
        const action = resolve(s, innTo('p1', [SCOUTS, ROWDY_PUB, TENTS]))
        expect(s.denizensAt('p1')).toEqual([LONGBOWS, INN])
        expect(s.denizensAt('c2')).toEqual([])
        expect(s.discardPileCounts).toEqual(counts(0, 3, 2))
        expect(piles(s)).toEqual({
            [Region.Cradle]: [],
            [Region.Provinces]: [ROWDY_PUB, FILLER, FILLER],
            [Region.Hinterland]: [TENTS, SCOUTS]
        })
        expect(action.metadata).toMatchObject({
            discardedCardIds: [FILLER, FILLER, ROWDY_PUB],
            discardedCount: 3,
            pileDeposits: [{ region: Region.Hinterland, cardIds: [SCOUTS, TENTS] }]
        })
    })

    it('a later Search of the Hinterland pile draws Scouts', () => {
        const s = cropRotation()
        resolve(s, innTo('p1', [SCOUTS]))
        s.getPlayerState(DANA).siteId = 'h1'
        openTurn(s, DANA)
        new HydratedSearch(
            buildAction(Search, {
                playerId: DANA,
                drawFrom: SearchSource.Discard,
                revealsInfo: true,
                modifiers: []
            })
        ).apply(s)
        expect(s.getPlayerState(DANA).knownHand()).toEqual([SCOUTS])
        expect(s.discardPileCounts[Region.Hinterland]).toBe(0)
    })

    it('each seat sees the same pile counts, and the play cannot be undone', () => {
        const s = cropRotation()
        const action = resolve(s, innTo('p1', [SCOUTS]))
        expect(action.revealsInfo).toBe(true)
        for (const perspective of [
            { kind: 'player', playerId: DANA },
            { kind: 'player', playerId: RHYS },
            { kind: 'spectator' }
        ] as Visibility.Perspective[]) {
            expect(served(s, perspective).discardPileCounts).toEqual(counts(0, 2, 1))
        }
    })
})

describe('unchanged at revision 33', () => {
    it('at Dana’s own Great Slum the card discarded first goes to the Provinces pile with the Search’s', () => {
        const s = searched({
            denizensBySite: { c1: [SCOUTS, TENTS, LONGBOWS] },
            siteCards: { c1: GREAT_SLUM }
        })
        const action = resolve(s, {
            keptCardId: INN,
            discardOrder: [FILLER, FILLER],
            play: SearchPlay.Site,
            discardFirstCardIds: [SCOUTS]
        })
        expect(s.denizensAt('c1')).toEqual([TENTS, LONGBOWS, INN])
        expect(s.discardPileCounts).toEqual(counts(0, 3, 0))
        expect(piles(s)[Region.Provinces]).toEqual([SCOUTS, FILLER, FILLER])
        expect(action.metadata?.discardedCardIds).toEqual([FILLER, FILLER, SCOUTS])
        expect(action.metadata?.pileDeposits).toBeUndefined()
    })

    it("the People's Favor's card at c2, in Dana's region, while the Inn goes to p1: the Provinces pile", () => {
        const s = searched({
            denizensBySite: { c2: [ROWDY_PUB], p1: [SCOUTS] },
            advisers: [NEW_GROWTH],
            favor: true
        })
        const action = resolve(s, innTo('p1', [ROWDY_PUB]))
        expect(s.discardPileCounts).toEqual(counts(0, 3, 0))
        expect(piles(s)[Region.Provinces]).toEqual([ROWDY_PUB, FILLER, FILLER])
        expect(action.metadata?.pileDeposits).toBeUndefined()
    })

    it('Bracken: every discard goes to the pile named, the card discarded first in another region too', () => {
        for (const revision of [FIXED, ...BEFORE]) {
            const s = searched({
                revision,
                denizensBySite: { p1: [SCOUTS, TENTS, LONGBOWS] },
                advisers: [NEW_GROWTH, CROP_ROTATION, BRACKEN],
                uses: [
                    modifierUse(NEW_GROWTH),
                    modifierUse(CROP_ROTATION),
                    modifierUse(BRACKEN, [region(Region.Cradle)])
                ]
            })
            const action = resolve(s, innTo('p1', [SCOUTS]))
            expect(s.discardPileCounts, `revision ${revision}`).toEqual(counts(3, 0, 0))
            expect(piles(s)[Region.Cradle]).toEqual([SCOUTS, FILLER, FILLER])
            expect(action.metadata?.discardedCardIds).toEqual([FILLER, FILLER, SCOUTS])
            expect(action.metadata?.discardPileRegion).toBe(Region.Cradle)
            expect(action.metadata?.pileDeposits).toBeUndefined()
        }
    })

    it('Cracked Horn: every discard goes under the world deck, the card discarded first in another region too', () => {
        for (const revision of [FIXED, ...BEFORE]) {
            const s = searched({
                revision,
                denizensBySite: { p1: [SCOUTS, TENTS, LONGBOWS] },
                advisers: [NEW_GROWTH, CROP_ROTATION],
                relics: [CRACKED_HORN],
                uses: [
                    modifierUse(NEW_GROWTH),
                    modifierUse(CROP_ROTATION),
                    modifierUse(CRACKED_HORN)
                ]
            })
            const action = resolve(s, innTo('p1', [SCOUTS]))
            expect(s.discardPileCounts, `revision ${revision}`).toEqual(counts(0, 0, 0))
            expect(s.requireVault().worldDeck).toContain(SCOUTS)
            expect(action.metadata?.discardedCardIds).toEqual([FILLER, FILLER, SCOUTS])
            expect(action.metadata?.discardToWorldDeck).toBe(true)
            expect(action.metadata?.pileDeposits).toBeUndefined()
        }
    })
})

describe('before revision 33 a game keeps the pile it was recorded with', () => {
    for (const revision of BEFORE) {
        it(`revision ${revision}: Scouts at p1, by Crop Rotation or the Great Slum, go to the Provinces pile`, () => {
            for (const s of [cropRotation(revision), greatSlum(revision)]) {
                const action = resolve(s, innTo('p1', [SCOUTS]))
                expect(s.denizensAt('p1')).toEqual([TENTS, LONGBOWS, INN])
                expect(s.discardPileCounts).toEqual(counts(0, 3, 0))
                expect(piles(s)[Region.Provinces]).toEqual([SCOUTS, FILLER, FILLER])
                expect(action.metadata?.discardedCardIds).toEqual([FILLER, FILLER, SCOUTS])
                expect(action.metadata?.pileDeposits).toBeUndefined()
            }
        })
    }
})

describe('the facedown adviser play (R-6.1, "as if you searched")', () => {
    /** Dana has the Inn facedown and plays it faceup to p1's Great Slum by New Growth, discarding Scouts there first. */
    function facedown(revision: OathRevision) {
        const s = table({
            revision,
            denizensBySite: { p1: [SCOUTS, TENTS, LONGBOWS] },
            siteCards: { p1: GREAT_SLUM },
            advisers: [NEW_GROWTH]
        })
        s.getPlayerState(DANA).addAdviser(INN, false)
        const choice = {
            cardId: INN,
            play: SearchPlay.Site,
            toSiteId: 'p1',
            discardFirstCardId: SCOUTS,
            modifiers: [modifierUse(NEW_GROWTH)]
        }
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, choice)).toBeUndefined()
        const action = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: DANA, ...choice })
        )
        action.apply(s)
        expect(s.denizensAt('p1')).toEqual([TENTS, LONGBOWS, INN])
        return { s, action }
    }

    it('from revision 33 Scouts go to the Hinterland pile', () => {
        const { s, action } = facedown(FIXED)
        expect(s.discardPileCounts).toEqual(counts(0, 0, 1))
        expect(piles(s)[Region.Hinterland]).toEqual([SCOUTS])
        expect(action.metadata).toMatchObject({
            discardedCardIds: [],
            pileDeposits: [{ region: Region.Hinterland, cardIds: [SCOUTS] }]
        })
        expect(action.revealsInfo).toBe(true)
    })

    for (const revision of BEFORE) {
        it(`at revision ${revision} Scouts go to the Provinces pile`, () => {
            const { s, action } = facedown(revision)
            expect(s.discardPileCounts).toEqual(counts(0, 1, 0))
            expect(piles(s)[Region.Provinces]).toEqual([SCOUTS])
            expect(action.metadata?.discardedCardIds).toEqual([SCOUTS])
            expect(action.metadata?.pileDeposits).toBeUndefined()
        })
    }
})
