import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, CardKind, Region } from '../model/oathEnums.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind } from '../model/question.js'
import type { TablePositions } from '../model/playerState.js'
import { isVision } from '../data/cardRegistry.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { answerQuestion } from '../testing/steps.js'
import { modifierUse, region, yes } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
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
    banners
}: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: danaAt,
                favor: 4,
                secrets: 2,
                supply: 6,
                relicIds,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: !facedown.includes(cardId) }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: rhysAt, favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [], ...denizensBySite },
            warbandsBySite: { [danaAt]: { dana: 1 } },
            ...(banners ? { banners } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = deck
    if (revealedVision) s.getPlayerState('dana').revealedVisionId = revealedVision
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
            const asked = (s: HydratedOathGameState) => {
                const { beneath: _beneath, ...question } = s.pendingQuestions!.queue[0] as {
                    beneath?: number
                }
                return { question, queued: s.pendingQuestions!.queue.length }
            }
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
