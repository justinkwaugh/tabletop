import { describe, expect, it } from 'vitest'
import type { Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchSwap, SearchSwap } from '../actions/searchSwap.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedPlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { ActionType } from '../definition/actions.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import {
    DANA,
    GREAT_SPIRE,
    PLAINS_SLOT,
    RHYS,
    WOLVES,
    edificeTable,
    fillDispossessed
} from '../testing/edifices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { usableModifiers, type ModifierUse } from '../util/modifiers.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { legalPowers, reasonCannotUsePower } from '../util/powerDoorway.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import './index.js'

// Great Spire: "You may swap any number of denizens you draw with random cards from the Dispossessed." Cost: place 1
// secret. The Dispossessed is filled only by the Chronicle (Law 8.5), and as many as there are (R-9.3), so a game can
// open with it empty and keep it empty: every swap takes back as many cards as it puts in. From revision 34 a Search
// that declares Great Spire while the Dispossessed is empty is refused before anything is paid, as no drawn denizen
// could swap; the Dispossessed's size is public (R-8.5), so every seat judges it alike. Before revision 34 a game
// keeps what it accepted: the Search, and the secret placed on the Spire.

const FIXED = OathRevision.EngineFixes29
const BEFORE = OathRevision.EngineFixes28
const EARLIER = OathRevision.EngineFixes27

const INTACT = 0
const RUINED = 1
const SPIRE_USE: ModifierUse = { cardId: GREAT_SPIRE, powerIndex: INTACT }
const HARP = 'relic.truthful-harp'
const HARP_USE: ModifierUse = { cardId: HARP, powerIndex: 0 }
const FORCED_LABOR = 'denizen.order.forced-labor'
const ORACLE = 'denizen.nomad.oracle'

const TENTS = 'denizen.nomad.tents'
const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const NAYSAYERS = 'denizen.discord.naysayers'
const SCOUTS = 'denizen.order.scouts'
const SUPREMACY = 'vision.supremacy'

const DECK = [TENTS, RANGERS, ELDERS, SCOUTS]
const PILE = [SCOUTS, ELDERS]

const SPIRE_EMPTY = `${GREAT_SPIRE}: the Dispossessed is empty, so no drawn denizen can swap`
const SPIRE_DRAWS_NOTHING = `${GREAT_SPIRE} changes a Search's draw, and this play draws nothing`
const SPIRE_OWN_TEXT = `${GREAT_SPIRE} changes a Search's draw, and this power draws by its own text`

const danaView: Visibility.Perspective = { kind: 'player', playerId: DANA }
const rhysView: Visibility.Perspective = { kind: 'player', playerId: RHYS }

/** A seat's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState, view: Visibility.Perspective) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)

/**
 * Dana, the Chancellor, on turn at the Plains (the Cradle), which they rule, with Great Spire intact there; 2
 * secrets, 4 favor and their Supply. The world deck holds four denizens and the Cradle's discard pile two; the
 * Dispossessed holds `dispossessed`, empty by default.
 */
function spireTable(
    revision: OathRevision,
    {
        dispossessed = [],
        over = {},
        state = {}
    }: {
        dispossessed?: string[]
        over?: Record<string, Record<string, unknown>>
        state?: Parameters<typeof edificeTable>[1]
    } = {}
): HydratedOathGameState {
    const s = edificeTable(over, { oathRevision: revision, ...state }, { plains: GREAT_SPIRE })
    s.requireVault().worldDeck = [...DECK]
    s.requireVault().discardPiles[Region.Cradle] = [...PILE]
    s.discardPileCounts[Region.Cradle] = PILE.length
    fillDispossessed(s, dispossessed)
    return s
}

function search(
    s: HydratedOathGameState,
    modifiers: ModifierUse[] = [SPIRE_USE],
    drawFrom = SearchSource.WorldDeck,
    tolls?: string[]
): HydratedSearch {
    const action = new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom,
            revealsInfo: true,
            modifiers,
            ...(tolls ? { tolls } : {})
        })
    )
    action.apply(s)
    return action
}

const reason = (
    s: HydratedOathGameState,
    modifiers: ModifierUse[] = [SPIRE_USE],
    drawFrom = SearchSource.WorldDeck,
    tolls?: string[]
) => HydratedSearch.reasonCannotSearch(s, DANA, drawFrom, modifiers, tolls)

const listed = (s: HydratedOathGameState) =>
    usableModifiers(s, DANA, ActionType.Search).map((power) => power.cardId)

/** What a refused Search must leave as it was: every token, the hand and the cards it would draw from. */
function untouched(s: HydratedOathGameState) {
    const dana = s.getPlayerState(DANA)
    const rhys = s.getPlayerState(RHYS)
    return {
        secrets: dana.secrets,
        favor: dana.favor,
        supply: dana.supply,
        rhysFavor: rhys.favor,
        onSpire: s.tokensOn(GREAT_SPIRE).secrets,
        hand: dana.knownHand(),
        handShown: dana.handShown,
        worldDeck: [...s.requireVault().worldDeck],
        pile: [...s.requireVault().discardPiles[Region.Cradle]],
        pileCount: s.discardPileCounts[Region.Cradle]
    }
}

describe('revision 34', () => {
    it('is EngineFixes29, and current', () => {
        expect(OathRevision.EngineFixes29).toBe(34)
        expect(CURRENT_OATH_REVISION).toBe(OathRevision.EngineFixes29)
    })
})

describe('Great Spire declared with the Dispossessed empty is refused before anything is paid (revision 34)', () => {
    it('is not offered among the Search cards', () => {
        expect(listed(spireTable(FIXED))).not.toContain(GREAT_SPIRE)
    })

    it('a Search of the world deck declaring it is refused, naming the Spire and the empty Dispossessed', () => {
        const s = spireTable(FIXED)
        expect(reason(s)).toBe(SPIRE_EMPTY)
        const before = untouched(s)
        expect(() => search(s)).toThrow(`Cannot search: ${SPIRE_EMPTY}`)
        // No secret placed, no Supply spent, nothing drawn.
        expect(untouched(s)).toEqual(before)
        expect(before.secrets).toBe(2)
        expect(before.onSpire).toBe(0)
        expect(before.hand).toEqual([])
    })

    it('so is a Search of the discard pile', () => {
        const s = spireTable(FIXED)
        expect(reason(s, [SPIRE_USE], SearchSource.Discard)).toBe(SPIRE_EMPTY)
        const before = untouched(s)
        expect(() => search(s, [SPIRE_USE], SearchSource.Discard)).toThrow(SPIRE_EMPTY)
        expect(untouched(s)).toEqual(before)
    })

    it('through the engine: refused, and the game goes on from the same state', () => {
        const s = spireTable(FIXED)
        const state = s.dehydrate()
        const kept = structuredClone(state)
        const game = testGame([DANA, RHYS])
        const declared = buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [SPIRE_USE]
        })
        expect(() => engine.runNext(declared, state, game)).toThrow(SPIRE_EMPTY)
        expect(state).toEqual(kept)
        const plain = buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
        const after = engine.runNext(plain, state, game).updatedState
        expect(after.players.find((p) => p.playerId === DANA)?.secrets).toBe(2)
    })

    it('with the Truthful Harp declared beside it, the whole declaration is refused: nothing revealed, nothing paid', () => {
        const s = spireTable(FIXED, { over: { [DANA]: { relicIds: [HARP] } } })
        for (const modifiers of [
            [SPIRE_USE, HARP_USE],
            [HARP_USE, SPIRE_USE]
        ]) {
            expect(reason(s, modifiers)).toBe(SPIRE_EMPTY)
            const before = untouched(s)
            expect(() => search(s, modifiers)).toThrow(SPIRE_EMPTY)
            expect(untouched(s)).toEqual(before)
            expect(s.getPlayerState(DANA).handShown).toBeUndefined()
        }
        // The Harp alone is accepted as today.
        expect(reason(s, [HARP_USE])).toBeUndefined()
    })

    it("with Forced Labor's toll on the Search, nothing is paid: no favor given, no secret placed", () => {
        // Dana's pawn at the River, which Rhys rules with Forced Labor there; the Spire at the Plains, which Dana rules.
        const s = spireTable(FIXED, {
            over: {
                [DANA]: { siteId: 'c2' },
                [RHYS]: { siteId: 'c2', warbandsOnBoard: { [RHYS]: 2 } }
            },
            state: {
                denizensBySite: { [PLAINS_SLOT]: [WOLVES], p1: [], c2: [FORCED_LABOR] },
                warbandsBySite: {
                    [PLAINS_SLOT]: { [IMPERIAL_WARBANDS]: 2 },
                    c2: { [RHYS]: 2 }
                }
            }
        })
        expect(reason(s, [])).toBe(
            `${FORCED_LABOR}: you cannot search from here unless you give a favor to its ruler`
        )
        expect(reason(s, [], SearchSource.WorldDeck, [FORCED_LABOR])).toBeUndefined()
        expect(reason(s, [SPIRE_USE], SearchSource.WorldDeck, [FORCED_LABOR])).toBe(SPIRE_EMPTY)
        const before = untouched(s)
        expect(() => search(s, [SPIRE_USE], SearchSource.WorldDeck, [FORCED_LABOR])).toThrow(
            SPIRE_EMPTY
        )
        expect(untouched(s)).toEqual(before)
    })

    it("each seat's own view gives the same answer as the server, from the public count alone", () => {
        const s = spireTable(FIXED)
        for (const view of [danaView, rhysView]) {
            const own = ownView(s, view)
            expect(own.dispossessedCount).toBe(0)
            expect(listed(own)).not.toContain(GREAT_SPIRE)
            expect(reason(own)).toBe(SPIRE_EMPTY)
        }
        const filled = spireTable(FIXED, { dispossessed: [NAYSAYERS] })
        const own = ownView(filled, danaView)
        // The seat cannot read the Dispossessed's cards, only how many there are.
        expect(() => own.requireVault()).toThrow()
        expect(own.dispossessedCount).toBe(1)
        expect(listed(own)).toContain(GREAT_SPIRE)
        expect(reason(own)).toBeUndefined()
    })
})

describe('unchanged at revision 34', () => {
    it('with one card in the Dispossessed, it is offered, accepted, and swaps as today', () => {
        const s = spireTable(FIXED, { dispossessed: [NAYSAYERS] })
        expect(listed(s)).toContain(GREAT_SPIRE)
        expect(reason(s)).toBeUndefined()
        search(s)
        expect(s.getPlayerState(DANA).secrets).toBe(1)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(HydratedSearchSwap.canDoSearchSwap(s, DANA)).toBe(true)
        new HydratedSearchSwap(
            buildAction(SearchSwap, {
                playerId: DANA,
                revealsInfo: true,
                swappedCardIds: [RANGERS]
            })
        ).apply(s)
        expect(s.getPlayerState(DANA).knownHand()).toEqual([TENTS, NAYSAYERS, ELDERS])
        expect(s.requireVault().dispossessed).toEqual([RANGERS])
        expect(s.dispossessedCount).toBe(1)
    })

    it('a Search without the Spire, with the Dispossessed empty, is accepted', () => {
        const s = spireTable(FIXED)
        expect(reason(s, [])).toBeUndefined()
        search(s, [])
        expect(s.getPlayerState(DANA).knownHand()).toEqual([TENTS, RANGERS, ELDERS])
        expect(s.getPlayerState(DANA).secrets).toBe(2)
    })

    it('Fallen Spire with the Dispossessed empty offers no count, as today', () => {
        const s = edificeTable({}, { oathRevision: FIXED }, { plains: GREAT_SPIRE, ruined: true })
        s.requireVault().discardPiles[Region.Cradle] = [...PILE]
        s.discardPileCounts[Region.Cradle] = PILE.length
        const fallen = legalPowers(s, DANA, PowerTiming.Action).find(
            (use) => use.cardId === GREAT_SPIRE && use.powerIndex === RUINED
        )
        expect(fallen?.choices[0].options).toEqual([])
        expect(
            reasonCannotUsePower(s, DANA, GREAT_SPIRE, RUINED, PowerTiming.Action, [
                { kind: PowerChoiceKind.Count, n: 1 }
            ])
        ).toBe('1 is not among the options for denizens to swap')
    })

    it('a facedown adviser played as if searched (R-6.1) keeps the reason it had: the play draws nothing', () => {
        const s = spireTable(FIXED, {
            over: { [DANA]: { advisers: [{ cardId: TENTS, faceUp: false }] } }
        })
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, {
                cardId: TENTS,
                play: SearchPlay.Site,
                modifiers: [SPIRE_USE]
            })
        ).toBe(SPIRE_DRAWS_NOTHING)
    })

    it("Oracle's use keeps the reason it had: the power draws by its own text", () => {
        const s = spireTable(FIXED, {
            over: { [DANA]: { advisers: [{ cardId: ORACLE, faceUp: true }] } }
        })
        s.requireVault().worldDeck = [TENTS, SUPREMACY]
        s.worldDeckVisions = 1
        expect(
            HydratedUseActionPower.reasonCannotUse(
                s,
                DANA,
                ORACLE,
                powerIndexOf(ORACLE, PowerTiming.Action),
                [],
                [modifierUse(GREAT_SPIRE)]
            )
        ).toBe(SPIRE_OWN_TEXT)
    })
})

describe('before revision 34 a game keeps what it accepted: the Spire with the Dispossessed empty', () => {
    for (const revision of [BEFORE, EARLIER]) {
        it(`at revision ${revision}: offered, accepted, and its secret placed`, () => {
            const s = spireTable(revision)
            expect(listed(s)).toContain(GREAT_SPIRE)
            expect(reason(s)).toBeUndefined()
            search(s)
            expect(s.getPlayerState(DANA).secrets).toBe(1)
            expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
            expect(s.getPlayerState(DANA).knownHand()).toEqual([TENTS, RANGERS, ELDERS])
            // No card to swap with: the swap step is not offered, and the Search goes on to its play.
            expect(HydratedSearchSwap.reasonSwapUnavailable(s, DANA)).toBe(
                'the Dispossessed is empty'
            )
        })
    }

    it('at revision 33, with the Truthful Harp beside it, both are accepted and the draw shown', () => {
        const s = spireTable(BEFORE, { over: { [DANA]: { relicIds: [HARP] } } })
        expect(reason(s, [SPIRE_USE, HARP_USE])).toBeUndefined()
        search(s, [SPIRE_USE, HARP_USE])
        expect(s.getPlayerState(DANA).handShown).toBe(true)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
    })

    it("at revision 33, each seat's own view accepts it as the server does", () => {
        const s = spireTable(BEFORE)
        for (const view of [danaView, rhysView])
            expect(listed(ownView(s, view))).toContain(GREAT_SPIRE)
        expect(reason(ownView(s, danaView))).toBeUndefined()
    })
})
