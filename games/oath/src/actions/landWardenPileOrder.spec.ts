import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { CardKind, Region } from '../model/oathEnums.js'
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
    revealedVision
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
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: rhysAt, favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [], ...denizensBySite },
            warbandsBySite: { [danaAt]: { dana: 1 } }
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

    it('a kept power that discards two cards to one pile asks their order after the Search: they go on Tents', () => {
        for (const revision of [FIXED, OathRevision.EngineFixes27]) {
            const { s } = longbowsScene(revision, { denizensBySite: { c2: [SCOUTS, INN] } })
            expect(s.denizensAt('c2')).toEqual([])
            expect(pile(s, Region.Provinces)).toEqual([TENTS, FILLER])
            expect(s.pendingQuestions?.queue[0]).toMatchObject({
                kind: PowerQuestionKind.OrderDiscards,
                cardIds: [SCOUTS, INN]
            })
            answerQuestion(s, 'dana', { kind: PowerQuestionKind.OrderDiscards, order: [1, 0] })
            expect(pile(s, Region.Provinces)).toEqual([SCOUTS, INN, TENTS, FILLER])
            expectRecordsFollowPile(s, Region.Provinces)
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
