import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, CardKind, Region } from '../model/oathEnums.js'
import { HydratedAnswerQuestion } from './answerQuestion.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedOathGameState, OathGameStateValidator } from '../model/gameState.js'
import { PowerQuestionKind, type ExchangeTerms, type QuestionAnswer } from '../model/question.js'
import type { TablePositions } from '../model/playerState.js'
import { isVision } from '../data/cardRegistry.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { answerQuestion } from '../testing/steps.js'
import { served } from '../testing/projection.js'
import { card, modifierUse, region, yes } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { settleQueue } from '../util/questionAnswers.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import '../powers/index.js'

const LAND_WARDEN = 'denizen.hearth.land-warden'
const DAZZLE = 'denizen.arcane.dazzle'
const ROAR = 'denizen.beast.threatening-roar'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const LONGBOWS = 'denizen.order.longbows'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const BRACKEN = 'denizen.beast.bracken'
const HORN = 'relic.cracked-horn'
const HARP = 'relic.truthful-harp'
const CONQUEST = 'vision.conquest'
const FAITH = 'vision.faith'
const RIOTS = 'denizen.discord.riots'
const SALT = 'denizen.discord.salt-the-earth'
const STORYTELLER = 'denizen.hearth.storyteller'
const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const TWIN = 'denizen.nomad.twin-brother'
const WAGON = 'denizen.nomad.family-wagon'
const BEWITCH = 'denizen.arcane.bewitch'
const PILGRIMAGE = 'denizen.nomad.pilgrimage'
const GATHERING = 'denizen.nomad.the-gathering'
const SANCTUARY = 'vision.sanctuary'
const HERALD = 'denizen.hearth.herald'

const FIXED = OathRevision.EngineFixes28
const BEFORE = [OathRevision.EngineFixes27, OathRevision.EngineFixes26]
const SEATS = ['dana', 'rhys', 'chancellor']

interface Table {
    revision: OathRevision
    /** Dana's site, and Rhys's: c1 and c2 unless given. */
    danaAt?: string
    rhysAt?: string
    denizensBySite?: Record<string, string[]>
    advisers?: string[]
    relicIds?: string[]
    deck?: string[]
    revealedVision?: string
    /** Dana's advisers held facedown. */
    facedown?: string[]
    banners?: NonNullable<Parameters<typeof testState>[1]>['banners']
    secrets?: number
    rhysAdvisers?: string[]
    /** Rhys's advisers held facedown. */
    rhysFacedown?: string[]
    rhysRelicIds?: string[]
    rhysVision?: string
    /** Each Vision's warbands, by whose they are. */
    warbandsOnCards?: Record<string, Record<string, number>>
}

/** Dana, an Exile, holds Land Warden; Rhys is another Exile; a Chancellor sits away from play. */
function table({
    revision,
    danaAt = 'c1',
    rhysAt = 'c2',
    denizensBySite = {},
    advisers = [],
    relicIds = [],
    deck = [],
    revealedVision,
    facedown = [],
    banners,
    secrets = 2,
    rhysAdvisers = [],
    rhysFacedown = [],
    rhysRelicIds = [],
    rhysVision,
    warbandsOnCards
}: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: danaAt,
                favor: 4,
                secrets,
                supply: 6,
                relicIds,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: !facedown.includes(cardId) }))
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: rhysAt,
                favor: 2,
                relicIds: rhysRelicIds,
                warbandsInPersonalBank: { rhys: 5 },
                advisers: rhysAdvisers.map((cardId) => ({
                    cardId,
                    faceUp: !rhysFacedown.includes(cardId)
                }))
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [], ...denizensBySite },
            warbandsBySite: { [danaAt]: { dana: 1 } },
            ...(banners ? { banners } : {}),
            ...(warbandsOnCards ? { warbandsOnCards } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = deck
    if (revealedVision) s.getPlayerState('dana').revealedVisionId = revealedVision
    if (rhysVision) s.getPlayerState('rhys').revealedVisionId = rhysVision
    return s
}

function search(
    s: HydratedOathGameState,
    playerId: string,
    uses: ReturnType<typeof modifierUse>[],
    from = SearchSource.WorldDeck
) {
    const action = new HydratedSearch(
        buildAction(Search, { playerId, drawFrom: from, revealsInfo: true, modifiers: uses })
    )
    action.apply(s)
    return action
}

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)).toBeUndefined()
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return action
}

const pile = (s: HydratedOathGameState, at: Region) => s.requireVault().discardPiles[at]

const back = (cardId: string) => (isVision(cardId) ? CardKind.Vision : CardKind.Denizen)

/** Each seat's record of a pile, and the table's: who knows which card, or which back, lies where. */
function records(s: HydratedOathGameState, at: Region): Record<string, TablePositions> {
    return {
        everyone: s.seenDiscardPiles[at],
        ...Object.fromEntries(
            SEATS.map((id) => [id, s.getPlayerState(id).knownDiscardPiles?.[at] ?? []])
        )
    }
}

/** What each witness knows of each card in the pile, whatever its place. */
function views(s: HydratedOathGameState, at: Region): Record<string, string[]> {
    return Object.fromEntries(
        Object.entries(records(s, at)).map(([witness, positions]) => [
            witness,
            positions
                .map((entry) =>
                    entry === null
                        ? 'unknown'
                        : typeof entry === 'string'
                          ? entry
                          : 'among' in entry
                            ? `among ${[...entry.among].sort().join(',')}`
                            : `back ${entry.back}`
                )
                .sort()
        ])
    )
}

/** What each witness knows of a pile, without the places it holds open for cards it does not know. */
function known(s: HydratedOathGameState, at: Region): Record<string, string[]> {
    return Object.fromEntries(
        Object.entries(views(s, at)).map(([witness, entries]) => [
            witness,
            entries.filter((entry) => entry !== 'unknown')
        ])
    )
}

/** Every record agrees with the hidden pile, card by card: a known card, or a known back, is the one there. */
function expectRecordsFollowPile(s: HydratedOathGameState, at: Region) {
    const cards = pile(s, at)
    for (const [witness, positions] of Object.entries(records(s, at)))
        for (const [fromBottom, entry] of positions.entries()) {
            const there = cards[cards.length - 1 - fromBottom]
            if (entry === null) continue
            if (typeof entry === 'string') expect(there, `${witness} at ${fromBottom}`).toBe(entry)
            else if ('among' in entry)
                expect(entry.among, `${witness} at ${fromBottom}`).toContain(there)
            else expect(back(there), `${witness} at ${fromBottom}`).toBe(entry.back)
        }
    // R-9.4 — the public top back is the top card's.
    if (cards.length > 0) expect(s.discardTopBackType?.[at]).toBe(back(cards[0]))
    expect(s.discardPileCounts[at]).toBe(cards.length)
}

const LONGBOWS_SECOND: SearchResolveChoice = {
    keptCardId: DAZZLE,
    discardOrder: [FILLER],
    play: SearchPlay.Site,
    secondPlay: {
        cardId: LONGBOWS,
        play: SearchPlay.Adviser,
        faceUp: true,
        discardedAdviserCardIds: [TENTS]
    }
}

/** Dazzle kept to Dana's site discards Scouts at Rhys's; Longbows second, at the adviser limit, discards Tents. */
function longbowsScene(revision: OathRevision, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        denizensBySite: { c2: [SCOUTS] },
        advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
        deck: [DAZZLE, LONGBOWS, FILLER],
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    return { s, action: resolve(s, LONGBOWS_SECOND) }
}

/** Dazzle kept to Dana's site discards Scouts at Rhys's; Faith second replaces Conquest as the Revealed Vision. */
function faithScene(revision: OathRevision, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        denizensBySite: { c2: [SCOUTS] },
        advisers: [LAND_WARDEN],
        deck: [DAZZLE, FAITH],
        revealedVision: CONQUEST,
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    const action = resolve(s, {
        keptCardId: DAZZLE,
        discardOrder: [],
        play: SearchPlay.Site,
        secondPlay: { cardId: FAITH, play: SearchPlay.RevealedVision }
    })
    return { s, action }
}

/** What is asked, of whom, and what else is waiting, whatever the Search marked for the answers. */
function asked(s: HydratedOathGameState) {
    const { underSecondPlay: _mark, ...pending } = s.pendingQuestions!
    return pending
}

/** What the History reads from the record: the same at every revision. */
function recorded(action: HydratedSearchResolve) {
    const { discardedCardIds, discardedCount, pileDeposits, discardPileRegion } = action.metadata!
    return { discardedCardIds, discardedCount, pileDeposits, discardPileRegion }
}

describe('revision 33', () => {
    it('is EngineFixes28, and current', () => {
        expect(OathRevision.EngineFixes28).toBe(33)
        expect(CURRENT_OATH_REVISION).toBe(OathRevision.EngineFixes28)
    })
})

describe("Land Warden: the second play's own discards lie above the kept card's power's", () => {
    it('Longbows second at the adviser limit: Tents lies on Scouts, which Dazzle discarded', () => {
        const { s } = longbowsScene(FIXED)
        expect(s.denizensAt('c2')).toEqual([])
        expect(s.getPlayerState('dana').advisers.map((a) => a.cardId)).not.toContain(TENTS)
        expect(pile(s, Region.Provinces)).toEqual([TENTS, SCOUTS, FILLER])
        expectRecordsFollowPile(s, Region.Provinces)
    })

    it('Faith second replacing Conquest: Conquest lies on top, under the Vision back the table sees', () => {
        const { s } = faithScene(FIXED)
        expect(s.getPlayerState('dana').revealedVisionId).toBe(FAITH)
        expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
        expect(pile(s, Region.Provinces)).toEqual([CONQUEST, SCOUTS])
        expectRecordsFollowPile(s, Region.Provinces)
    })

    it('in the Provinces, both scenes fill the Hinterland pile in the order played', () => {
        const longbows = longbowsScene(FIXED, {
            danaAt: 'p1',
            rhysAt: 'p2',
            denizensBySite: { p2: [SCOUTS] }
        }).s
        expect(pile(longbows, Region.Hinterland)).toEqual([TENTS, SCOUTS, FILLER])
        expectRecordsFollowPile(longbows, Region.Hinterland)
        const faith = faithScene(FIXED, {
            danaAt: 'p1',
            rhysAt: 'p2',
            denizensBySite: { p2: [SCOUTS] }
        }).s
        expect(pile(faith, Region.Hinterland)).toEqual([CONQUEST, SCOUTS])
        expectRecordsFollowPile(faith, Region.Hinterland)
    })

    it('in the Hinterland, both scenes fill the Cradle pile in the order played', () => {
        const longbows = longbowsScene(FIXED, {
            danaAt: 'h1',
            rhysAt: 'h2',
            denizensBySite: { h2: [SCOUTS] }
        }).s
        expect(pile(longbows, Region.Cradle)).toEqual([TENTS, SCOUTS, FILLER])
        expectRecordsFollowPile(longbows, Region.Cradle)
        const faith = faithScene(FIXED, {
            danaAt: 'h1',
            rhysAt: 'h2',
            denizensBySite: { h2: [SCOUTS] }
        }).s
        expect(pile(faith, Region.Cradle)).toEqual([CONQUEST, SCOUTS])
        expectRecordsFollowPile(faith, Region.Cradle)
    })

    it("Threatening Roar second at the adviser limit: Tents goes on Dazzle's Scouts, then Roar's own Wolves on top", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [SCOUTS, WOLVES] },
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [DAZZLE, ROAR, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            ...LONGBOWS_SECOND,
            secondPlay: { ...LONGBOWS_SECOND.secondPlay!, cardId: ROAR }
        })
        expect(s.denizensAt('c2')).toEqual([])
        expect(pile(s, Region.Provinces)).toEqual([WOLVES, TENTS, SCOUTS, FILLER])
        expectRecordsFollowPile(s, Region.Provinces)
    })

    it('a later Search of that pile draws Tents, then Scouts, then the Wrestlers', () => {
        const { s } = longbowsScene(FIXED, { rhysAt: 'p1' })
        s.getPlayerState('rhys').supply = 6
        openTurn(s, 'rhys')
        search(s, 'rhys', [], SearchSource.Discard)
        expect(s.getPlayerState('rhys').knownHand()).toEqual([TENTS, SCOUTS, FILLER])
    })
})

describe('Land Warden: before revision 33 the pile keeps the order it had', () => {
    for (const revision of BEFORE) {
        it(`at revision ${revision}: the Longbows scene leaves Scouts on Tents`, () => {
            const { s } = longbowsScene(revision)
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, TENTS, FILLER])
        })

        it(`at revision ${revision}: Threatening Roar second leaves Wolves, Scouts, Tents`, () => {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS, WOLVES] },
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                deck: [DAZZLE, ROAR, FILLER]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN)])
            resolve(s, {
                ...LONGBOWS_SECOND,
                secondPlay: { ...LONGBOWS_SECOND.secondPlay!, cardId: ROAR }
            })
            expect(pile(s, Region.Provinces)).toEqual([WOLVES, SCOUTS, TENTS, FILLER])
        })
    }
})

describe('Land Warden: the Faith scene before revision 33', () => {
    it('at revision 32: Scouts lies on Conquest', () => {
        const { s } = faithScene(OathRevision.EngineFixes27)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, CONQUEST])
    })
})

describe('Land Warden: only the order changes', () => {
    it('the record the History reads, and whether the Search can be undone, are the same at 32 and 33', () => {
        for (const scene of [longbowsScene, faithScene]) {
            const fixed = scene(FIXED).action
            const before = scene(OathRevision.EngineFixes27).action
            expect(recorded(fixed)).toEqual(recorded(before))
            expect(fixed.revealsInfo).toBe(before.revealsInfo)
            expect(fixed.revealsInfo).toBe(true)
        }
    })

    it("each seat's view of each discarded card is the same at 32 and 33", () => {
        for (const scene of [longbowsScene, faithScene]) {
            expect(views(scene(FIXED).s, Region.Provinces)).toEqual(
                views(scene(OathRevision.EngineFixes27).s, Region.Provinces)
            )
        }
    })

    it('with Truthful Harp showing the draw and the kept card, every seat sees the same cards at 32 and 33', () => {
        const choice = { ...LONGBOWS_SECOND, discardOrder: [FILLER, INN] }
        const at = (revision: OathRevision) => {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                relicIds: [HARP],
                deck: [DAZZLE, LONGBOWS, FILLER, INN]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN), modifierUse(HARP)])
            const action = resolve(s, choice)
            return { s, action }
        }
        const fixed = at(FIXED)
        const before = at(OathRevision.EngineFixes27)
        expect(fixed.action.metadata?.revealedKeptCardId).toBe(DAZZLE)
        expect(pile(fixed.s, Region.Provinces).slice(0, 2)).toEqual([TENTS, SCOUTS])
        expect(views(fixed.s, Region.Provinces)).toEqual(views(before.s, Region.Provinces))
        expectRecordsFollowPile(fixed.s, Region.Provinces)
    })

    it('Bracken naming the Provinces pile, on top: only the order changes', () => {
        const scene = (revision: OathRevision) => {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                advisers: [LAND_WARDEN, TENTS, BRACKEN],
                deck: [DAZZLE, LONGBOWS, FILLER]
            })
            search(s, 'dana', [
                modifierUse(LAND_WARDEN),
                modifierUse(BRACKEN, [region(Region.Provinces)])
            ])
            resolve(s, LONGBOWS_SECOND)
            return s
        }
        expect(pile(scene(FIXED), Region.Provinces)).toEqual([TENTS, SCOUTS, FILLER])
        expect(pile(scene(OathRevision.EngineFixes27), Region.Provinces)).toEqual([
            SCOUTS,
            TENTS,
            FILLER
        ])
        expectRecordsFollowPile(scene(FIXED), Region.Provinces)
    })

    it("Bracken sending the Search's discards to the bottom of another pile: the same at 32 and 33", () => {
        const scene = (revision: OathRevision) => {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                advisers: [LAND_WARDEN, TENTS, BRACKEN],
                deck: [DAZZLE, LONGBOWS, FILLER]
            })
            s.requireVault().discardPiles[Region.Cradle] = [INN]
            s.discardPileCounts[Region.Cradle] = 1
            search(s, 'dana', [
                modifierUse(LAND_WARDEN),
                modifierUse(BRACKEN, [region(Region.Cradle), yes])
            ])
            resolve(s, LONGBOWS_SECOND)
            return s
        }
        for (const s of [scene(FIXED), scene(OathRevision.EngineFixes27)]) {
            expect(pile(s, Region.Cradle)).toEqual([INN, FILLER, TENTS])
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS])
        }
    })

    it("Cracked Horn sending the Search's discards under the world deck: the same at 32 and 33", () => {
        const scene = (revision: OathRevision) => {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                relicIds: [HORN],
                deck: [DAZZLE, LONGBOWS, FILLER, INN]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN), modifierUse(HORN)])
            resolve(s, LONGBOWS_SECOND)
            return s
        }
        for (const s of [scene(FIXED), scene(OathRevision.EngineFixes27)]) {
            expect(s.requireVault().worldDeck.slice(-2)).toEqual([FILLER, TENTS])
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS])
        }
    })
})

describe('Land Warden: unchanged at revision 33', () => {
    it('a Search with no Land Warden: Dazzle kept, the rest discarded first', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                deck: [DAZZLE, LONGBOWS, FILLER]
            })
            search(s, 'dana', [])
            resolve(s, {
                keptCardId: DAZZLE,
                discardOrder: [FILLER, LONGBOWS],
                play: SearchPlay.Site
            })
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, LONGBOWS, FILLER])
        }
    })

    it("Land Warden whose kept card's power discards nothing", () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const { s } = longbowsScene(revision, { denizensBySite: { c2: [WOLVES] } })
            expect(s.denizensAt('c2')).toEqual([WOLVES])
            expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
        }
    })

    it("the kept card's own adviser-limit discard lies under the second card's power's", () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = table({
                revision,
                denizensBySite: { c2: [SCOUTS] },
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                deck: [LONGBOWS, DAZZLE, FILLER]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN)])
            resolve(s, {
                keptCardId: LONGBOWS,
                discardOrder: [FILLER],
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [TENTS],
                secondPlay: { cardId: DAZZLE, play: SearchPlay.Site }
            })
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, TENTS, FILLER])
            expectRecordsFollowPile(s, Region.Provinces)
        }
    })
})

/** Positions in the order question's cards, first discarded first: Scouts last, so on top; or the Inn on top. */
const SCOUTS_ON_TOP = [1, 0]
const INN_ON_TOP = [0, 1]

function answerOrder(s: HydratedOathGameState, order: readonly number[]) {
    return answerQuestion(s, 'dana', { kind: PowerQuestionKind.OrderDiscards, order: [...order] })
}

function expectOrderAsked(s: HydratedOathGameState, cardIds: string[]) {
    expect(s.pendingQuestions?.queue[0]).toMatchObject({
        kind: PowerQuestionKind.OrderDiscards,
        askedPlayerId: 'dana',
        cardIds
    })
}

const TWO_AT_C2 = { denizensBySite: { c2: [SCOUTS, INN] } }
const REGIONS = [Region.Cradle, Region.Provinces, Region.Hinterland]
const MOB = {
    [Banner.PeoplesFavor]: { value: 1, mobSide: true },
    [Banner.DarkestSecret]: { value: 1 }
}

/** Every pile, card by card, against each record, the top back and the count. */
function expectEveryPileFollowed(s: HydratedOathGameState) {
    for (const at of REGIONS) expectRecordsFollowPile(s, at)
}

/** What the table and each seat hold of every pile: its count, its top back, and each witness's view. */
function tableView(s: HydratedOathGameState) {
    return REGIONS.map((at) => ({
        count: s.discardPileCounts[at],
        back: s.discardTopBackType?.[at],
        views: views(s, at)
    }))
}

describe("Land Warden: the kept card's power's ordered discards lie under the second card's (R-7.3.3)", () => {
    for (const [name, order, under] of [
        ['Scouts on top', SCOUTS_ON_TOP, [SCOUTS, INN]],
        ['the Inn on top', INN_ON_TOP, [INN, SCOUTS]]
    ] as const) {
        it(`Longbows second discards Tents: Tents on top, then the two in the order answered (${name})`, () => {
            const { s } = longbowsScene(FIXED, TWO_AT_C2)
            expect(s.denizensAt('c2')).toEqual([])
            expectOrderAsked(s, [SCOUTS, INN])
            expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
            expectEveryPileFollowed(s)
            answerOrder(s, order)
            expect(pile(s, Region.Provinces)).toEqual([TENTS, ...under, FILLER])
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
            expectEveryPileFollowed(s)
        })

        it(`Faith second replacing Conquest: Conquest on top, under a Vision back (${name})`, () => {
            const { s } = faithScene(FIXED, TWO_AT_C2)
            expectOrderAsked(s, [SCOUTS, INN])
            expect(pile(s, Region.Provinces)).toEqual([CONQUEST])
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
            expectEveryPileFollowed(s)
            answerOrder(s, order)
            expect(pile(s, Region.Provinces)).toEqual([CONQUEST, ...under])
            // R-9.4 — the replaced Vision lies on top, so the table sees a Vision back.
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
            expectEveryPileFollowed(s)
        })
    }

    it('the question is asked as before: the same question, at the same moment, on the same table', () => {
        for (const scene of [longbowsScene, faithScene]) {
            const fixed = scene(FIXED, TWO_AT_C2).s
            const before = scene(OathRevision.EngineFixes27, TWO_AT_C2).s
            expect(asked(fixed)).toEqual(asked(before))
            expect(tableView(fixed)).toEqual(tableView(before))
            expect(fixed.machineState).toBe(before.machineState)
        }
    })

    it('after the answer only the order and the top back differ from before revision 33', () => {
        const fixed = faithScene(FIXED, TWO_AT_C2).s
        const before = faithScene(OathRevision.EngineFixes27, TWO_AT_C2).s
        const fixedAnswer = answerOrder(fixed, SCOUTS_ON_TOP)
        const beforeAnswer = answerOrder(before, SCOUTS_ON_TOP)
        expect(fixedAnswer.revealsInfo).toBe(beforeAnswer.revealsInfo)
        expect(fixedAnswer.metadata?.summary).toBe(beforeAnswer.metadata?.summary)
        expect(fixed.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
        expect(before.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
        expect(fixed.discardPileCounts).toEqual(before.discardPileCounts)
        for (const at of REGIONS) expect(views(fixed, at)).toEqual(views(before, at))
    })

    it('the History reads the same record, and neither the Search nor the answer can be undone, as before', () => {
        const fixed = longbowsScene(FIXED, TWO_AT_C2)
        const before = longbowsScene(OathRevision.EngineFixes27, TWO_AT_C2)
        expect(recorded(fixed.action)).toEqual(recorded(before.action))
        expect(fixed.action.revealsInfo).toBe(true)
        expect(before.action.revealsInfo).toBe(true)
        const fixedAnswer = answerOrder(fixed.s, INN_ON_TOP)
        const beforeAnswer = answerOrder(before.s, INN_ON_TOP)
        expect(fixedAnswer.revealsInfo).toBe(true)
        expect(beforeAnswer.revealsInfo).toBe(true)
        const deposited = (answer: typeof fixedAnswer) =>
            answer.metadata?.pileDeposits?.map(({ region, cardIds, bottom }) => ({
                region,
                cardIds,
                bottom
            }))
        expect(deposited(fixedAnswer)).toEqual(deposited(beforeAnswer))
    })

    it('a game saved between the Search and the answer replays the same', () => {
        const { s } = longbowsScene(FIXED, TWO_AT_C2)
        const saved = new HydratedOathGameState(JSON.parse(JSON.stringify(s.dehydrate())))
        answerOrder(s, SCOUTS_ON_TOP)
        answerOrder(saved, SCOUTS_ON_TOP)
        expect(pile(saved, Region.Provinces)).toEqual([TENTS, SCOUTS, INN, FILLER])
        expect(JSON.stringify(saved.dehydrate())).toBe(JSON.stringify(s.dehydrate()))
    })

    it('a later Search of that pile draws Tents, then the two in the order answered', () => {
        const { s } = longbowsScene(FIXED, { ...TWO_AT_C2, rhysAt: 'p1' })
        answerOrder(s, INN_ON_TOP)
        s.getPlayerState('rhys').supply = 6
        openTurn(s, 'rhys')
        search(s, 'rhys', [], SearchSource.Discard)
        expect(s.getPlayerState('rhys').knownHand()).toEqual([TENTS, INN, SCOUTS])
    })

    it("Threatening Roar second discards Tents, then two of its own: Dazzle's answer lies under Tents, Roar's on top", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [SCOUTS, INN, WOLVES, RANGERS] },
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [DAZZLE, ROAR, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            ...LONGBOWS_SECOND,
            secondPlay: { ...LONGBOWS_SECOND.secondPlay!, cardId: ROAR }
        })
        expect(s.denizensAt('c2')).toEqual([])
        expect(
            s.pendingQuestions?.queue.map((question) =>
                'cardIds' in question ? question.cardIds : []
            )
        ).toEqual([
            [SCOUTS, INN],
            [WOLVES, RANGERS]
        ])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([TENTS, SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([RANGERS, WOLVES, TENTS, SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it("Threatening Roar second discards Tents and one card of its own: both lie on Dazzle's two", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [SCOUTS, INN, WOLVES] },
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [DAZZLE, ROAR, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            ...LONGBOWS_SECOND,
            secondPlay: { ...LONGBOWS_SECOND.secondPlay!, cardId: ROAR }
        })
        expect(pile(s, Region.Provinces)).toEqual([WOLVES, TENTS, FILLER])
        answerOrder(s, INN_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([WOLVES, TENTS, INN, SCOUTS, FILLER])
        expectEveryPileFollowed(s)
    })

    it('Bracken naming the Provinces pile, on top: Tents lies on the two', () => {
        const s = table({
            revision: FIXED,
            ...TWO_AT_C2,
            advisers: [LAND_WARDEN, TENTS, BRACKEN],
            deck: [DAZZLE, LONGBOWS, FILLER]
        })
        search(s, 'dana', [
            modifierUse(LAND_WARDEN),
            modifierUse(BRACKEN, [region(Region.Provinces)])
        ])
        resolve(s, LONGBOWS_SECOND)
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([TENTS, SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it("Bracken naming the Provinces pile's bottom, or another pile, or the Cracked Horn: as before revision 33", () => {
        const scenes: {
            name: string
            advisers: string[]
            relicIds: string[]
            uses: ReturnType<typeof modifierUse>[]
            provinces: string[]
            cradle: string[]
        }[] = [
            {
                name: 'the bottom of the Provinces pile',
                advisers: [LAND_WARDEN, TENTS, BRACKEN],
                relicIds: [],
                uses: [modifierUse(BRACKEN, [region(Region.Provinces), yes])],
                provinces: [SCOUTS, INN, FILLER, TENTS],
                cradle: []
            },
            {
                name: 'the Cradle pile',
                advisers: [LAND_WARDEN, TENTS, BRACKEN],
                relicIds: [],
                uses: [modifierUse(BRACKEN, [region(Region.Cradle)])],
                provinces: [SCOUTS, INN],
                cradle: [TENTS, FILLER]
            },
            {
                name: 'the Cracked Horn',
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                relicIds: [HORN],
                uses: [modifierUse(HORN)],
                provinces: [SCOUTS, INN],
                cradle: []
            }
        ]
        for (const scene of scenes) {
            for (const revision of [FIXED, OathRevision.EngineFixes27]) {
                const s = table({
                    revision,
                    ...TWO_AT_C2,
                    advisers: scene.advisers,
                    relicIds: scene.relicIds,
                    deck: [DAZZLE, LONGBOWS, FILLER]
                })
                search(s, 'dana', [modifierUse(LAND_WARDEN), ...scene.uses])
                resolve(s, LONGBOWS_SECOND)
                answerOrder(s, SCOUTS_ON_TOP)
                const named = `${scene.name} at ${revision}`
                expect(pile(s, Region.Provinces), named).toEqual(scene.provinces)
                expect(pile(s, Region.Cradle), named).toEqual(scene.cradle)
                if (scene.relicIds.includes(HORN))
                    expect(s.requireVault().worldDeck.slice(-2), named).toEqual([FILLER, TENTS])
                expectEveryPileFollowed(s)
            }
        }
    })

    it('with Truthful Harp showing the draw and the kept card, every seat sees the same cards as before revision 33', () => {
        const at = (revision: OathRevision) => {
            const s = table({
                revision,
                ...TWO_AT_C2,
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                relicIds: [HARP],
                deck: [DAZZLE, LONGBOWS, FILLER, ELDERS]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN), modifierUse(HARP)])
            resolve(s, { ...LONGBOWS_SECOND, discardOrder: [FILLER, ELDERS] })
            return s
        }
        const fixed = at(FIXED)
        const before = at(OathRevision.EngineFixes27)
        expect(tableView(fixed)).toEqual(tableView(before))
        answerOrder(fixed, SCOUTS_ON_TOP)
        answerOrder(before, SCOUTS_ON_TOP)
        expect(pile(fixed, Region.Provinces).slice(0, 3)).toEqual([TENTS, SCOUTS, INN])
        for (const at of REGIONS) expect(views(fixed, at)).toEqual(views(before, at))
        expectEveryPileFollowed(fixed)
    })

    it('a facedown Tents shown to Rhys: no seat learns more of it, before the answer or after', () => {
        const at = (revision: OathRevision) => {
            const s = table({
                revision,
                ...TWO_AT_C2,
                advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
                facedown: [TENTS],
                deck: [DAZZLE, LONGBOWS, FILLER]
            })
            s.getPlayerState('dana').markShown(TENTS, 'rhys')
            search(s, 'dana', [modifierUse(LAND_WARDEN)])
            resolve(s, LONGBOWS_SECOND)
            return s
        }
        const s = at(FIXED)
        // What each witness knew of the pile beyond the two faceup cards the answer puts down.
        const known = () =>
            Object.fromEntries(
                Object.entries(views(s, Region.Provinces)).map(([witness, view]) => [
                    witness,
                    view.filter((entry) => ![SCOUTS, INN, 'unknown'].includes(entry))
                ])
            )
        const asked = known()
        expectEveryPileFollowed(s)
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([TENTS, SCOUTS, INN, FILLER])
        expect(known()).toEqual(asked)
        expect(asked.rhys).toEqual([`among ${TENTS}`])
        expect(asked.chancellor.join()).not.toContain(TENTS)
        expect(asked.everyone.join()).not.toContain(TENTS)
        expectEveryPileFollowed(s)
    })
})

describe('Land Warden: each kept power that asks an order lies under the second card', () => {
    it("Threatening Roar kept to Dana's site, discarding itself and Wolves: Tents on top", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [WOLVES] },
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [ROAR, LONGBOWS, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: ROAR })
        expectOrderAsked(s, [ROAR, WOLVES])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, WOLVES, ROAR, FILLER])
        expectEveryPileFollowed(s)
    })

    it('Riots kept, discarding two cards to one pile: they lie under Tents', () => {
        const s = table({
            revision: FIXED,
            banners: MOB,
            denizensBySite: { c2: [INN, STORYTELLER] },
            advisers: [LAND_WARDEN, TENTS, SCOUTS],
            deck: [RIOTS, LONGBOWS, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: RIOTS })
        expectOrderAsked(s, [INN, STORYTELLER])
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, STORYTELLER, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('Riots kept, discarding one card to each of two piles: no question, and Tents lies on its one', () => {
        const s = table({
            revision: FIXED,
            banners: MOB,
            denizensBySite: { c2: [INN], p1: [STORYTELLER] },
            advisers: [LAND_WARDEN, TENTS, SCOUTS],
            deck: [RIOTS, LONGBOWS, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: RIOTS })
        expect(s.pendingQuestions).toBeUndefined()
        expect(pile(s, Region.Provinces)).toEqual([TENTS, INN, FILLER])
        expect(pile(s, Region.Hinterland)).toEqual([STORYTELLER])
        expectEveryPileFollowed(s)
    })

    it('Riots kept, asking for one pile while Tents goes to another: that pile takes the two on top', () => {
        const s = table({
            revision: FIXED,
            banners: MOB,
            denizensBySite: { p1: [INN, STORYTELLER] },
            advisers: [LAND_WARDEN, TENTS, SCOUTS],
            deck: [RIOTS, LONGBOWS, FILLER]
        })
        s.requireVault().discardPiles[Region.Hinterland] = [ELDERS]
        s.discardPileCounts[Region.Hinterland] = 1
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: RIOTS })
        expectOrderAsked(s, [INN, STORYTELLER])
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Hinterland)).toEqual([STORYTELLER, INN, ELDERS])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
        expectEveryPileFollowed(s)
    })

    it("Salt the Earth kept to Dana's site, discarding the two there: Tents on top", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c1: [SCOUTS, INN] },
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [SALT, LONGBOWS, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: SALT })
        expectOrderAsked(s, [SCOUTS, INN])
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([TENTS, SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })
})

describe("Land Warden: the kept power's ordered discards before revision 33", () => {
    for (const revision of BEFORE) {
        it(`at revision ${revision}: the two go on Tents, in the order answered`, () => {
            const { s } = longbowsScene(revision, TWO_AT_C2)
            expect(s.denizensAt('c2')).toEqual([])
            expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
            expectOrderAsked(s, [SCOUTS, INN])
            answerOrder(s, SCOUTS_ON_TOP)
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, TENTS, FILLER])
            expectEveryPileFollowed(s)
        })
    }

    it('at revision 32: Faith second leaves the two on Conquest, under a denizen back', () => {
        const { s } = faithScene(OathRevision.EngineFixes27, TWO_AT_C2)
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, CONQUEST])
        expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
    })
})

describe("Land Warden: the kept power's ordered discards, unchanged at revision 33", () => {
    it("the same question with no Land Warden: the two go on the Search's discards", () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = table({ revision, ...TWO_AT_C2, deck: [DAZZLE, LONGBOWS, FILLER] })
            search(s, 'dana', [])
            resolve(s, {
                keptCardId: DAZZLE,
                discardOrder: [FILLER, LONGBOWS],
                play: SearchPlay.Site
            })
            expectOrderAsked(s, [SCOUTS, INN])
            answerOrder(s, SCOUTS_ON_TOP)
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, LONGBOWS, FILLER])
            expectEveryPileFollowed(s)
        }
    })

    it('Land Warden whose second card discards nothing: the two go on top', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = table({
                revision,
                ...TWO_AT_C2,
                advisers: [LAND_WARDEN],
                deck: [DAZZLE, LONGBOWS, FILLER]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN)])
            resolve(s, {
                keptCardId: DAZZLE,
                discardOrder: [FILLER],
                play: SearchPlay.Site,
                secondPlay: { cardId: LONGBOWS, play: SearchPlay.Adviser, faceUp: true }
            })
            expectOrderAsked(s, [SCOUTS, INN])
            answerOrder(s, SCOUTS_ON_TOP)
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, FILLER])
            expectEveryPileFollowed(s)
        }
    })
})

/** Dana keeps Twin Brother and takes Rhys's Family Wagon, leaving Rhys over the limit; Dazzle second discards Scouts. */
function twinScene(revision: OathRevision, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        denizensBySite: { c2: [SCOUTS] },
        advisers: [LAND_WARDEN],
        rhysAdvisers: [WAGON, ELDERS, TENTS, INN],
        deck: [TWIN, DAZZLE, FILLER],
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    resolve(s, {
        keptCardId: TWIN,
        discardOrder: [FILLER],
        play: SearchPlay.Adviser,
        faceUp: true,
        choices: [card(WAGON)],
        secondPlay: { cardId: DAZZLE, play: SearchPlay.Site }
    })
    return s
}

/** Twin Brother kept as above, but Threatening Roar second, which discards Wolves and itself and asks their order. */
function twinRoarScene(revision: OathRevision, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        denizensBySite: { c2: [WOLVES] },
        advisers: [LAND_WARDEN],
        rhysAdvisers: [WAGON, ELDERS, TENTS, INN],
        deck: [TWIN, ROAR, FILLER],
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    resolve(s, {
        keptCardId: TWIN,
        discardOrder: [FILLER],
        play: SearchPlay.Adviser,
        faceUp: true,
        choices: [card(WAGON)],
        secondPlay: { cardId: ROAR, play: SearchPlay.Site }
    })
    return s
}

function discardAdvisers(s: HydratedOathGameState, by: string, ...cardIds: string[]) {
    return answerQuestion(s, by, {
        kind: PowerQuestionKind.DiscardAdvisers,
        discardedAdviserCardIds: cardIds
    })
}

/** Dana keeps Faith over Conquest, which holds Rhys's warband (False Prophet); Dazzle second discards Scouts. */
function falseProphetScene(revision: OathRevision, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        denizensBySite: { c2: [SCOUTS] },
        advisers: [LAND_WARDEN],
        deck: [FILLER, DAZZLE, FAITH],
        revealedVision: CONQUEST,
        warbandsOnCards: { [CONQUEST]: { rhys: 1 } },
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    resolve(s, {
        keptCardId: FAITH,
        discardOrder: [FILLER],
        play: SearchPlay.RevealedVision,
        secondPlay: { cardId: DAZZLE, play: SearchPlay.Site }
    })
    return s
}

function answerVision(
    s: HydratedOathGameState,
    by: string,
    play: SearchPlay,
    extra: { discardedAdviserCardId?: string; modifiers?: ReturnType<typeof modifierUse>[] } = {}
) {
    return answerQuestion(s, by, { kind: PowerQuestionKind.PlayOrDiscardVision, play, ...extra })
}

/** Dana, in the Provinces, keeps Pilgrimage, whose two drawn cards ask their order; Riots second discards the Inn. */
function pilgrimageTable(
    revision: OathRevision,
    {
        dispossessed = [ELDERS, ROWDY_PUB, ROAR, TENTS, DAZZLE],
        ...extra
    }: Partial<Table> & { dispossessed?: string[] } = {}
) {
    const s = table({
        revision,
        danaAt: 'p1',
        banners: MOB,
        denizensBySite: { p1: [SCOUTS, WOLVES], c2: [INN], h1: [STORYTELLER] },
        advisers: [LAND_WARDEN],
        deck: [PILGRIMAGE, RIOTS, FILLER],
        ...extra
    })
    s.requireVault().dispossessed = dispossessed
    s.dispossessedCount = dispossessed.length
    return s
}

function resolvePilgrimage(s: HydratedOathGameState, uses: ReturnType<typeof modifierUse>[] = []) {
    search(s, 'dana', [modifierUse(LAND_WARDEN), ...uses])
    resolve(s, {
        keptCardId: PILGRIMAGE,
        discardOrder: [FILLER],
        play: SearchPlay.Adviser,
        faceUp: true,
        secondPlay: { cardId: RIOTS, play: SearchPlay.Site }
    })
    const question = s.pendingQuestions!.queue[0]
    if (question.kind !== PowerQuestionKind.OrderDrawnCards || !question.cardIds)
        throw Error('no stack is asked')
    return question.cardIds
}

function answerDrawn(s: HydratedOathGameState, order: number[]) {
    return answerQuestion(s, 'dana', { kind: PowerQuestionKind.OrderDrawnCards, order })
}

/** What a seat is served of the table, with the question still open. */
function seatView(s: HydratedOathGameState, playerId: string) {
    return new HydratedOathGameState(served(s, { kind: 'player', playerId }))
}

describe('Land Warden: an adviser limit the kept card left open is discarded under the second card (R-7.3.3)', () => {
    it("Twin Brother's swap: Rhys's discard lies under Dazzle's Scouts, and the top back never changes", () => {
        const s = twinScene(FIXED)
        expect(s.getPlayerState('dana').hasAdviser(WAGON)).toBe(true)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.DiscardAdvisers
        ])
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, FILLER])
        expectEveryPileFollowed(s)
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, FILLER])
        expect(s.pendingQuestions?.queue).toEqual([])
        expectEveryPileFollowed(s)
    })

    for (const revision of BEFORE) {
        it(`at revision ${revision}: Rhys's discard lies on Scouts, as it always did`, () => {
            const s = twinScene(revision)
            discardAdvisers(s, 'rhys', INN)
            expect(pile(s, Region.Provinces)).toEqual([INN, SCOUTS, FILLER])
            expectEveryPileFollowed(s)
        })
    }

    it('Rhys over by two: both lie under Scouts, the one named last nearest it', () => {
        for (const [revision, expected] of [
            [FIXED, [SCOUTS, TENTS, INN, FILLER]],
            [OathRevision.EngineFixes27, [TENTS, INN, SCOUTS, FILLER]]
        ] as const) {
            const s = twinScene(revision, {
                rhysAdvisers: [WAGON, ELDERS, TENTS, INN, ROWDY_PUB]
            })
            discardAdvisers(s, 'rhys', INN, TENTS)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual(expected)
            expectEveryPileFollowed(s)
        }
    })

    it("Rhys in another region: the card goes to Rhys's pile, on top, and Scouts's pile is untouched", () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = twinScene(revision, { rhysAt: 'p1' })
            discardAdvisers(s, 'rhys', INN)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual([SCOUTS, FILLER])
            expect(pile(s, Region.Hinterland), `revision ${revision}`).toEqual([INN])
            expectEveryPileFollowed(s)
        }
    })

    it("in the Provinces, the Hinterland pile takes Rhys's discard under Scouts", () => {
        const s = twinScene(FIXED, {
            danaAt: 'p1',
            rhysAt: 'p2',
            denizensBySite: { p2: [SCOUTS] }
        })
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Hinterland)).toEqual([SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('a facedown adviser Rhys discards is exactly as hidden as before revision 33', () => {
        const at = (revision: OathRevision) => {
            const s = twinScene(revision, { rhysFacedown: [INN] })
            discardAdvisers(s, 'rhys', INN)
            expectEveryPileFollowed(s)
            return s
        }
        const fixed = at(FIXED)
        const before = at(OathRevision.EngineFixes27)
        expect(pile(fixed, Region.Provinces)).toEqual([SCOUTS, INN, FILLER])
        for (const region of REGIONS) expect(known(fixed, region)).toEqual(known(before, region))
        for (const witness of ['everyone', 'dana', 'chancellor'])
            expect(views(fixed, Region.Provinces)[witness]).not.toContain(INN)
        expect(views(fixed, Region.Provinces)['rhys']).toContain(INN)
    })

    it("the second card asking an order of its own: Rhys's card first, then the order answered on top", () => {
        const s = twinRoarScene(FIXED)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.DiscardAdvisers,
            PowerQuestionKind.OrderDiscards
        ])
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Provinces)).toEqual([INN, FILLER])
        expectEveryPileFollowed(s)
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([WOLVES, ROAR, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('Rhys in another region, with the second card asking an order: each pile in the order played', () => {
        const s = twinRoarScene(FIXED, { rhysAt: 'p1' })
        discardAdvisers(s, 'rhys', INN)
        answerOrder(s, [1, 0])
        expect(pile(s, Region.Provinces)).toEqual([ROAR, WOLVES, FILLER])
        expect(pile(s, Region.Hinterland)).toEqual([INN])
        expectEveryPileFollowed(s)
    })

    it('a later Search of that pile draws Scouts, then the Inn, then the Wrestlers', () => {
        const s = twinScene(FIXED)
        discardAdvisers(s, 'rhys', INN)
        s.getPlayerState('rhys').siteId = 'p1'
        s.getPlayerState('rhys').supply = 6
        openTurn(s, 'rhys')
        search(s, 'rhys', [], SearchSource.Discard)
        expect(s.getPlayerState('rhys').knownHand()).toEqual([SCOUTS, INN, FILLER])
    })
})

describe("Land Warden: False Prophet's Vision, left open by the kept card, goes under the second card", () => {
    it('Rhys discards Conquest: it lies under Scouts, and the top back stays a denizen', () => {
        const s = falseProphetScene(FIXED)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.PlayOrDiscardVision
        ])
        expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
        expectEveryPileFollowed(s)
        answerVision(s, 'rhys', SearchPlay.Discard)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, CONQUEST, FILLER])
        // R-9.4 — the second card's discard lies on top.
        expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
        expectEveryPileFollowed(s)
    })

    for (const revision of BEFORE) {
        it(`at revision ${revision}: Conquest lies on Scouts, under a Vision back`, () => {
            const s = falseProphetScene(revision)
            answerVision(s, 'rhys', SearchPlay.Discard)
            expect(pile(s, Region.Provinces)).toEqual([CONQUEST, SCOUTS, FILLER])
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
            expectEveryPileFollowed(s)
        })
    }

    it('Rhys plays Conquest as their Revealed Vision, with none before it: no pile changes, as before', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = falseProphetScene(revision)
            answerVision(s, 'rhys', SearchPlay.RevealedVision)
            expect(s.getPlayerState('rhys').revealedVisionId).toBe(CONQUEST)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual([SCOUTS, FILLER])
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Denizen)
            expectEveryPileFollowed(s)
        }
    })

    it('Rhys plays Conquest over their own Vision: the old one lies under Scouts', () => {
        for (const [revision, expected, shown] of [
            [FIXED, [SCOUTS, SANCTUARY, FILLER], CardKind.Denizen],
            [OathRevision.EngineFixes27, [SANCTUARY, SCOUTS, FILLER], CardKind.Vision]
        ] as const) {
            const s = falseProphetScene(revision, { rhysVision: SANCTUARY })
            answerVision(s, 'rhys', SearchPlay.RevealedVision)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual(expected)
            expect(s.discardTopBackType?.[Region.Provinces]).toBe(shown)
            expectEveryPileFollowed(s)
        }
    })

    it('Rhys plays Conquest as an adviser at the limit: the adviser they discard lies under Scouts', () => {
        for (const [revision, expected] of [
            [FIXED, [SCOUTS, INN, FILLER]],
            [OathRevision.EngineFixes27, [INN, SCOUTS, FILLER]]
        ] as const) {
            const s = falseProphetScene(revision, { rhysAdvisers: [TENTS, ROWDY_PUB, INN] })
            answerVision(s, 'rhys', SearchPlay.Adviser, { discardedAdviserCardId: INN })
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual(expected)
            expect(s.getPlayerState('rhys').hasAdviser(CONQUEST)).toBe(true)
            expectEveryPileFollowed(s)
        }
    })

    it('Rhys in another region: Conquest goes to their pile, on top', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = falseProphetScene(revision, { rhysAt: 'p1' })
            answerVision(s, 'rhys', SearchPlay.Discard)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual([SCOUTS, FILLER])
            expect(pile(s, Region.Hinterland), `revision ${revision}`).toEqual([CONQUEST])
            expectEveryPileFollowed(s)
        }
    })

    it("Bracken and the Cracked Horn on Rhys's answer keep their target: only the order on the top differs", () => {
        const scenes: {
            name: string
            extra: Partial<Table>
            use: ReturnType<typeof modifierUse>
            /** The Provinces pile at revision 33, and at 32. */
            provinces: [string[], string[]]
            cradle: string[]
        }[] = [
            {
                name: 'Bracken naming the Provinces pile, on top',
                extra: { rhysAdvisers: [BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Provinces)]),
                provinces: [
                    [SCOUTS, CONQUEST, FILLER],
                    [CONQUEST, SCOUTS, FILLER]
                ],
                cradle: []
            },
            {
                name: "Bracken naming the Provinces pile's bottom",
                extra: { rhysAdvisers: [BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Provinces), yes]),
                provinces: [
                    [SCOUTS, FILLER, CONQUEST],
                    [SCOUTS, FILLER, CONQUEST]
                ],
                cradle: []
            },
            {
                name: 'Bracken naming the Cradle pile',
                extra: { rhysAdvisers: [BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Cradle)]),
                provinces: [
                    [SCOUTS, FILLER],
                    [SCOUTS, FILLER]
                ],
                cradle: [CONQUEST]
            },
            {
                name: 'the Cracked Horn',
                extra: { rhysRelicIds: [HORN] },
                use: modifierUse(HORN),
                provinces: [
                    [SCOUTS, FILLER],
                    [SCOUTS, FILLER]
                ],
                cradle: []
            }
        ]
        for (const scene of scenes)
            for (const [at, revision] of [FIXED, OathRevision.EngineFixes27].entries()) {
                const s = falseProphetScene(revision, scene.extra)
                answerVision(s, 'rhys', SearchPlay.Discard, { modifiers: [scene.use] })
                const named = `${scene.name} at ${revision}`
                expect(pile(s, Region.Provinces), named).toEqual(scene.provinces[at])
                expect(pile(s, Region.Cradle), named).toEqual(scene.cradle)
                if (scene.extra.rhysRelicIds)
                    expect(s.requireVault().worldDeck.at(-1), named).toBe(CONQUEST)
                expectEveryPileFollowed(s)
            }
    })

    it('a Vision Dana then answers for, the question the answer raised, also lies under Scouts', () => {
        const s = falseProphetScene(FIXED, {
            rhysVision: SANCTUARY,
            warbandsOnCards: { [CONQUEST]: { rhys: 1 }, [SANCTUARY]: { dana: 1 } }
        })
        answerVision(s, 'rhys', SearchPlay.RevealedVision)
        expect(s.pendingQuestions?.queue).toMatchObject([
            { kind: PowerQuestionKind.PlayOrDiscardVision, askedPlayerId: 'dana' }
        ])
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, FILLER])
        answerVision(s, 'dana', SearchPlay.Discard)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, SANCTUARY, FILLER])
        expectEveryPileFollowed(s)
    })

    it("that question, asked after the second card's own order: it goes on top, where it is answered", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [WOLVES] },
            advisers: [LAND_WARDEN],
            deck: [FILLER, ROAR, FAITH],
            revealedVision: CONQUEST,
            rhysVision: SANCTUARY,
            warbandsOnCards: { [CONQUEST]: { rhys: 1 }, [SANCTUARY]: { dana: 1 } }
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            keptCardId: FAITH,
            discardOrder: [FILLER],
            play: SearchPlay.RevealedVision,
            secondPlay: { cardId: ROAR, play: SearchPlay.Site }
        })
        answerVision(s, 'rhys', SearchPlay.RevealedVision)
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.OrderDiscards,
            PowerQuestionKind.PlayOrDiscardVision
        ])
        answerOrder(s, [0, 1])
        answerVision(s, 'dana', SearchPlay.Discard)
        expect(pile(s, Region.Provinces)).toEqual([SANCTUARY, WOLVES, ROAR, FILLER])
        expectEveryPileFollowed(s)
    })

    it("the second card's Vision: Dazzle kept, Faith second, the two in the order answered and Conquest on them", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [SCOUTS, INN] },
            advisers: [LAND_WARDEN],
            deck: [DAZZLE, FAITH],
            revealedVision: CONQUEST,
            warbandsOnCards: { [CONQUEST]: { rhys: 1 } }
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            keptCardId: DAZZLE,
            discardOrder: [],
            play: SearchPlay.Site,
            secondPlay: { cardId: FAITH, play: SearchPlay.RevealedVision }
        })
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.OrderDiscards,
            PowerQuestionKind.PlayOrDiscardVision
        ])
        answerOrder(s, SCOUTS_ON_TOP)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN])
        answerVision(s, 'rhys', SearchPlay.Discard)
        expect(pile(s, Region.Provinces)).toEqual([CONQUEST, SCOUTS, INN])
        expect(s.discardTopBackType?.[Region.Provinces]).toBe(CardKind.Vision)
        expectEveryPileFollowed(s)
    })

    it('Bewitch kept: the Vision it discards at once stays under Tents, with nothing asked', () => {
        const s = table({
            revision: FIXED,
            advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
            deck: [BEWITCH, LONGBOWS, FILLER],
            revealedVision: CONQUEST,
            secrets: 3
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            keptCardId: BEWITCH,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            choices: [yes],
            secondPlay: {
                cardId: LONGBOWS,
                play: SearchPlay.Adviser,
                faceUp: true,
                discardedAdviserCardIds: [TENTS]
            }
        })
        expect(s.pendingQuestions).toBeUndefined()
        expect(pile(s, Region.Provinces)).toEqual([TENTS, CONQUEST, FILLER])
        expectEveryPileFollowed(s)
    })
})

describe("Land Warden: Pilgrimage's stack, ordered after the Search, lies under the second card's discard", () => {
    for (const order of [
        [0, 1],
        [1, 0]
    ]) {
        it(`in the order answered (${order.join(', ')}), with the Inn on top`, () => {
            const s = pilgrimageTable(FIXED)
            const drawn = resolvePilgrimage(s)
            expect(pile(s, Region.Provinces)).toEqual([INN])
            expectEveryPileFollowed(s)
            answerDrawn(s, order)
            const [first, second] = order.map((row) => drawn[row])
            expect(pile(s, Region.Provinces)).toEqual([INN, second, first])
            expectEveryPileFollowed(s)
        })
    }

    for (const revision of BEFORE) {
        it(`at revision ${revision}: the stack lies on the Inn`, () => {
            const s = pilgrimageTable(revision)
            const drawn = resolvePilgrimage(s)
            answerDrawn(s, [0, 1])
            expect(pile(s, Region.Provinces)).toEqual([drawn[1], drawn[0], INN])
            expectEveryPileFollowed(s)
        })
    }

    it('drawn back from an empty Dispossessed: every seat keeps the same set record as before revision 33', () => {
        const at = (revision: OathRevision) => {
            const s = pilgrimageTable(revision, { dispossessed: [] })
            resolvePilgrimage(s)
            answerDrawn(s, [0, 1])
            expectEveryPileFollowed(s)
            return s
        }
        const fixed = at(FIXED)
        const before = at(OathRevision.EngineFixes27)
        expect(pile(fixed, Region.Provinces)[0]).toBe(INN)
        expect(pile(before, Region.Provinces)[2]).toBe(INN)
        for (const region of REGIONS) expect(known(fixed, region)).toEqual(known(before, region))
        expect(
            views(fixed, Region.Provinces)['everyone'].filter((entry) => entry.startsWith('among'))
        ).toHaveLength(2)
    })

    it('Bracken or the Cracked Horn in play: every card keeps its pile, and only the order on it changes', () => {
        for (const scene of [
            {
                name: 'Bracken on the Provinces pile',
                extra: { advisers: [LAND_WARDEN, BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Provinces)])
            },
            {
                name: "Bracken on the Provinces pile's bottom",
                extra: { advisers: [LAND_WARDEN, BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Provinces), yes])
            },
            {
                name: 'Bracken on the Cradle pile',
                extra: { advisers: [LAND_WARDEN, BRACKEN] },
                use: modifierUse(BRACKEN, [region(Region.Cradle)])
            },
            { name: 'the Cracked Horn', extra: { relicIds: [HORN] }, use: modifierUse(HORN) }
        ]) {
            const played = (revision: OathRevision) => {
                const s = pilgrimageTable(revision, scene.extra)
                const drawn = resolvePilgrimage(s, [scene.use])
                answerDrawn(s, [0, 1])
                expectEveryPileFollowed(s)
                return { s, drawn }
            }
            const { s: fixed, drawn } = played(FIXED)
            const { s: before } = played(OathRevision.EngineFixes27)
            expect(fixed.requireVault().worldDeck, scene.name).toEqual(
                before.requireVault().worldDeck
            )
            expect(fixed.discardPileCounts, scene.name).toEqual(before.discardPileCounts)
            for (const at of REGIONS)
                expect([...pile(fixed, at)].sort(), `${scene.name} ${at}`).toEqual(
                    [...pile(before, at)].sort()
                )
            // The stack lies under what the second card put on its pile, over what the Search put there first.
            const stack = [drawn[1], drawn[0]]
            const earlier = pile(before, Region.Provinces).filter(
                (cardId) => cardId !== INN && !stack.includes(cardId)
            )
            expect(pile(fixed, Region.Provinces), scene.name).toEqual([
                ...(pile(before, Region.Provinces).includes(INN) ? [INN] : []),
                ...stack,
                ...earlier
            ])
        }
    })

    it('a later Search of that pile draws the Inn first', () => {
        const s = pilgrimageTable(FIXED)
        const drawn = resolvePilgrimage(s)
        answerDrawn(s, [0, 1])
        s.getPlayerState('rhys').siteId = 'p2'
        s.getPlayerState('rhys').supply = 6
        openTurn(s, 'rhys')
        search(s, 'rhys', [], SearchSource.Discard)
        expect(s.getPlayerState('rhys').knownHand()).toEqual([INN, drawn[1], drawn[0]])
    })
})

/** The proposer's first two advisers for the other seat's adviser in `theirRow`. */
const twoForOne = (theirRow: number): ExchangeTerms => ({
    fromProposer: { adviserRows: [0, 1] },
    fromCounterparty: { adviserRows: [theirRow] }
})

/** The Gathering kept at Dana's site, with Rhys there and the Chancellor away. */
function gatheringScene(revision: OathRevision, secondCardId: string, extra: Partial<Table> = {}) {
    const s = table({
        revision,
        rhysAt: 'c1',
        denizensBySite: { c2: [SCOUTS] },
        advisers: [WOLVES, ELDERS, LAND_WARDEN, HERALD],
        rhysAdvisers: [RANGERS, TENTS, INN],
        deck: [GATHERING, secondCardId, FILLER],
        ...extra
    })
    search(s, 'dana', [modifierUse(LAND_WARDEN)])
    resolve(s, {
        keptCardId: GATHERING,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        secondPlay: { cardId: secondCardId, play: SearchPlay.Site }
    })
    return s
}

/** The round of pawns over, Dana's proposal takes Rhys's Rangers for two advisers, leaving Rhys over the limit. */
function danaProposesTwoForOne(s: HydratedOathGameState) {
    settleQueue(s, {})
    answerQuestion(s, 'dana', {
        kind: PowerQuestionKind.GatheringFloor,
        proposal: { withPlayerId: 'rhys', terms: twoForOne(0) }
    })
    answerQuestion(s, 'rhys', { kind: PowerQuestionKind.Exchange, accept: true })
    expect(s.pendingQuestions?.queue[0]).toMatchObject({
        kind: PowerQuestionKind.DiscardAdvisers,
        askedPlayerId: 'rhys'
    })
}

function chancellorStaysAway(s: HydratedOathGameState) {
    answerQuestion(s, 'chancellor', { kind: PowerQuestionKind.JoinSite, join: false })
}

describe('Land Warden: The Gathering kept, its round of proposals comes after the second card', () => {
    it("an exchange leaving Rhys over the limit: the discard lies under Dazzle's Scouts", () => {
        const s = gatheringScene(FIXED, DAZZLE)
        chancellorStaysAway(s)
        danaProposesTwoForOne(s)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, FILLER])
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('at revision 32 the discard lies on Scouts', () => {
        const s = gatheringScene(OathRevision.EngineFixes27, DAZZLE)
        chancellorStaysAway(s)
        danaProposesTwoForOne(s)
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Provinces)).toEqual([INN, SCOUTS, FILLER])
        expectEveryPileFollowed(s)
    })

    it('the second card asking an order first: the discard lies under the order answered, as the cards were played', () => {
        const s = gatheringScene(FIXED, DAZZLE, { denizensBySite: { c2: [SCOUTS, STORYTELLER] } })
        expect(s.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
            PowerQuestionKind.JoinSite,
            PowerQuestionKind.OrderDiscards
        ])
        chancellorStaysAway(s)
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([STORYTELLER, SCOUTS, FILLER])
        danaProposesTwoForOne(s)
        discardAdvisers(s, 'rhys', INN)
        expect(pile(s, Region.Provinces)).toEqual([STORYTELLER, SCOUTS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('two proposals each ending over the limit: the earlier discard under the later, both under Scouts', () => {
        const s = gatheringScene(FIXED, DAZZLE)
        chancellorStaysAway(s)
        danaProposesTwoForOne(s)
        discardAdvisers(s, 'rhys', INN)
        // Dana now holds Land Warden, Herald and the Rangers: two more for Herald leaves them over the limit too.
        answerQuestion(s, 'rhys', {
            kind: PowerQuestionKind.GatheringFloor,
            proposal: { withPlayerId: 'dana', terms: twoForOne(1) }
        })
        answerQuestion(s, 'dana', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.DiscardAdvisers,
            askedPlayerId: 'dana'
        })
        discardAdvisers(s, 'dana', RANGERS)
        expect(pile(s, Region.Provinces)).toEqual([SCOUTS, RANGERS, INN, FILLER])
        expectEveryPileFollowed(s)
    })

    it('The Gathering second: its proposals come after the kept card and the second, so their discard goes on top', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const s = table({
                revision,
                rhysAt: 'c1',
                denizensBySite: { c2: [SCOUTS, STORYTELLER] },
                advisers: [WOLVES, ELDERS, LAND_WARDEN],
                rhysAdvisers: [RANGERS, TENTS, INN],
                deck: [DAZZLE, GATHERING, FILLER]
            })
            search(s, 'dana', [modifierUse(LAND_WARDEN)])
            resolve(s, {
                keptCardId: DAZZLE,
                discardOrder: [FILLER],
                play: SearchPlay.Site,
                secondPlay: { cardId: GATHERING, play: SearchPlay.Site }
            })
            answerOrder(s, [0, 1])
            chancellorStaysAway(s)
            danaProposesTwoForOne(s)
            discardAdvisers(s, 'rhys', INN)
            expect(pile(s, Region.Provinces), `revision ${revision}`).toEqual([
                INN,
                STORYTELLER,
                SCOUTS,
                FILLER
            ])
            expectEveryPileFollowed(s)
        }
    })
})

describe('Land Warden: several questions open at once', () => {
    it('Riots kept, asking for two piles, with Tents on one: each answer lies under what the second card put there', () => {
        const s = table({
            revision: FIXED,
            banners: MOB,
            denizensBySite: { c2: [INN, STORYTELLER], p1: [ROWDY_PUB, HERALD] },
            advisers: [LAND_WARDEN, TENTS, SCOUTS],
            deck: [RIOTS, LONGBOWS, FILLER]
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, { ...LONGBOWS_SECOND, keptCardId: RIOTS })
        expect(s.pendingQuestions?.queue).toMatchObject([
            { kind: PowerQuestionKind.OrderDiscards, fromRegion: Region.Cradle },
            { kind: PowerQuestionKind.OrderDiscards, fromRegion: Region.Provinces }
        ])
        answerOrder(s, [0, 1])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, STORYTELLER, INN, FILLER])
        expect(pile(s, Region.Hinterland)).toEqual([])
        expectEveryPileFollowed(s)
        answerOrder(s, [1, 0])
        expect(pile(s, Region.Provinces)).toEqual([TENTS, STORYTELLER, INN, FILLER])
        expect(pile(s, Region.Hinterland)).toEqual([ROWDY_PUB, HERALD])
        expectEveryPileFollowed(s)
    })

    it("Dazzle's order kept beside Faith's Vision: the second card's answer stays on top of the order", () => {
        const s = table({
            revision: FIXED,
            denizensBySite: { c2: [SCOUTS, INN] },
            advisers: [LAND_WARDEN],
            deck: [FILLER, DAZZLE, FAITH],
            revealedVision: CONQUEST,
            warbandsOnCards: { [CONQUEST]: { rhys: 1 } }
        })
        search(s, 'dana', [modifierUse(LAND_WARDEN)])
        resolve(s, {
            keptCardId: DAZZLE,
            discardOrder: [FILLER],
            play: SearchPlay.Site,
            secondPlay: { cardId: FAITH, play: SearchPlay.RevealedVision }
        })
        answerOrder(s, INN_ON_TOP)
        answerVision(s, 'rhys', SearchPlay.Discard)
        expect(pile(s, Region.Provinces)).toEqual([CONQUEST, INN, SCOUTS, FILLER])
        expectEveryPileFollowed(s)
    })
})

describe('Land Warden: these questions are asked as they always were', () => {
    const pilgrimageScene = (revision: OathRevision) => {
        const s = pilgrimageTable(revision)
        resolvePilgrimage(s)
        return s
    }
    const scenes: [string, (revision: OathRevision) => HydratedOathGameState][] = [
        ['Twin Brother', (revision) => twinScene(revision)],
        ['Twin Brother, the adviser facedown', (r) => twinScene(r, { rhysFacedown: [INN] })],
        ['False Prophet', (revision) => falseProphetScene(revision)],
        ['Pilgrimage', pilgrimageScene],
        ['The Gathering', (revision) => gatheringScene(revision, DAZZLE)]
    ]
    for (const [name, scene] of scenes) {
        it(`${name}: the same question, at the same moment, on the same table`, () => {
            const fixed = scene(FIXED)
            const before = scene(OathRevision.EngineFixes27)
            expect(asked(fixed)).toEqual(asked(before))
            expect(tableView(fixed)).toEqual(tableView(before))
            expect(fixed.machineState).toBe(before.machineState)
        })

        it(`${name}: each seat is served the same question and table as before revision 33`, () => {
            for (const id of SEATS) {
                const fixed = seatView(scene(FIXED), id)
                const before = seatView(scene(OathRevision.EngineFixes27), id)
                expect(asked(fixed), id).toEqual(asked(before))
                expect(fixed.discardPileCounts, id).toEqual(before.discardPileCounts)
                expect(fixed.discardTopBackType, id).toEqual(before.discardTopBackType)
            }
        })
    }

    const answers: [
        string,
        (revision: OathRevision) => HydratedOathGameState,
        string,
        QuestionAnswer
    ][] = [
        [
            'Twin Brother',
            (r) => twinScene(r),
            'rhys',
            { kind: PowerQuestionKind.DiscardAdvisers, discardedAdviserCardIds: [INN] }
        ],
        [
            'False Prophet',
            (r) => falseProphetScene(r),
            'rhys',
            { kind: PowerQuestionKind.PlayOrDiscardVision, play: SearchPlay.Discard }
        ],
        [
            'Pilgrimage',
            pilgrimageScene,
            'dana',
            { kind: PowerQuestionKind.OrderDrawnCards, order: [0, 1] }
        ]
    ]
    for (const [name, scene, by, given] of answers) {
        const answer = (s: HydratedOathGameState) => answerQuestion(s, by, given)

        it(`${name}: after the answer only the order and the top back differ, and the History reads the same`, () => {
            const fixed = scene(FIXED)
            const before = scene(OathRevision.EngineFixes27)
            const fixedAnswer = answer(fixed)
            const beforeAnswer = answer(before)
            expect(fixedAnswer.revealsInfo).toBe(beforeAnswer.revealsInfo)
            expect(fixedAnswer.metadata?.summary).toBe(beforeAnswer.metadata?.summary)
            expect(fixedAnswer.metadata?.discardedCardIds).toEqual(
                beforeAnswer.metadata?.discardedCardIds
            )
            expect(fixedAnswer.metadata?.discardPileRegion).toBe(
                beforeAnswer.metadata?.discardPileRegion
            )
            expect(fixed.discardPileCounts).toEqual(before.discardPileCounts)
            expect(fixed.machineState).toBe(before.machineState)
            for (const at of REGIONS) {
                expect(known(fixed, at)).toEqual(known(before, at))
                expect([...pile(fixed, at)].sort()).toEqual([...pile(before, at)].sort())
            }
        })

        it(`${name}: saved between the Search and the answer, the game replays the same`, () => {
            const s = scene(FIXED)
            expect(OathGameStateValidator.Check(s.dehydrate())).toBe(true)
            const saved = new HydratedOathGameState(JSON.parse(JSON.stringify(s.dehydrate())))
            expect(saved.pendingQuestions?.underSecondPlay).toBeDefined()
            expect(JSON.stringify(saved.dehydrate())).toBe(JSON.stringify(s.dehydrate()))
            answer(s)
            answer(saved)
            expect(JSON.stringify(saved.dehydrate())).toBe(JSON.stringify(s.dehydrate()))
        })

        it(`${name}: the asked seat's own view allows the answer, and every seat is served the table's counts after it`, () => {
            const s = scene(FIXED)
            expect(
                HydratedAnswerQuestion.reasonCannotAnswer(seatView(s, by), by, given)
            ).toBeUndefined()
            answer(s)
            for (const id of SEATS) {
                const seat = seatView(s, id)
                expect(seat.discardPileCounts, id).toEqual(s.discardPileCounts)
                expect(seat.discardTopBackType, id).toEqual(s.discardTopBackType)
            }
        })
    }
})
