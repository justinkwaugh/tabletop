import { describe, expect, it } from 'vitest'
import {
    Color,
    assertExists,
    latestPlayerUndoTarget,
    type GameAction,
    type Visibility
} from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from './searchResolve.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { Region } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, region, yes } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { GREAT_SPIRE, placeEdifice } from '../testing/edifices.js'
import { adviserLimitDiscards } from '../util/adviserLimit.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Oracle: "Draw the Vision closest to the top of the world deck. Play or discard it as if you searched." Its Q&A
// lets the Cracked Horn put the discarded Vision under the world deck, and Law 6.1 reads "as if you searched" with
// "(Restrictions and modifiers apply.)". Law 7.4: a modifier is used at the start of the action it modifies, so
// from revision 31 Oracle's use declares the Search modifiers that act on its play or discard, before the draw.

const ORACLE = 'denizen.nomad.oracle'
const HORN = 'relic.cracked-horn'
const BRACKEN = 'denizen.beast.bracken'
const WOLVES = 'denizen.beast.wolves'
const ELDERS = 'denizen.nomad.elders'
const AUGURY = 'denizen.arcane.augury'
const NEWS = 'denizen.hearth.news-from-afar'
const CONVOYS = 'denizen.nomad.convoys'
const FORCED_LABOR = 'denizen.order.forced-labor'
const SUPREMACY = 'vision.supremacy'
const FAITH = 'vision.faith'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

const HORN_USE = modifierUse(HORN)
const BRACKEN_CRADLE_BOTTOM = modifierUse(BRACKEN, [region(Region.Cradle), yes])
const SPIRE_USE = modifierUse(GREAT_SPIRE)

interface Table {
    /** Dana's faceup advisers. */
    advisers?: string[]
    /** Cards at Dana's site c1, beside Oracle. */
    atSite?: string[]
    revealedVisionId?: string
    favor?: number
    secrets?: number
    /** Rhys rules c1 and stands there, with Forced Labor there. */
    forcedLabor?: boolean
    deck?: string[]
}

/** Dana on turn at c1 (the Cradle) with Oracle there, the Cracked Horn and Bracken; the next Vision is Supremacy. */
function table(revision: OathRevision, t: Table = {}): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: t.favor ?? 3,
                secrets: t.secrets ?? 3,
                supply: 6,
                relicIds: [HORN],
                revealedVisionId: t.revealedVisionId,
                advisers: (t.advisers ?? [BRACKEN]).map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: t.forcedLabor ? 'c1' : 'c2',
                favor: 2,
                secrets: 2
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: {
                c1: [ORACLE, ...(t.forcedLabor ? [FORCED_LABOR] : []), ...(t.atSite ?? [])],
                c2: [],
                p1: [],
                h1: []
            },
            warbandsBySite: { c1: t.forcedLabor ? { rhys: 2 } : { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [...(t.deck ?? [INN, SUPREMACY, FILLER])]
    return s
}

function useAction(modifiers?: ModifierUse[], cardId = ORACLE) {
    return buildAction(UseActionPower, {
        playerId: 'dana',
        cardId,
        powerIndex: powerIndexOf(cardId, PowerTiming.Action),
        ...(modifiers ? { modifiers } : {})
    })
}

function used(s: HydratedOathGameState, modifiers?: ModifierUse[]): HydratedUseActionPower {
    const action = new HydratedUseActionPower(useAction(modifiers))
    action.apply(s)
    return action
}

function resolved(s: HydratedOathGameState, fields: Partial<SearchResolve>): HydratedSearchResolve {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: SUPREMACY,
            discardOrder: [],
            ...fields
        })
    )
    action.apply(s)
    return action
}

const reasonOf = (s: HydratedOathGameState, modifiers: ModifierUse[], cardId = ORACLE) =>
    HydratedUseActionPower.reasonCannotUse(
        s,
        'dana',
        cardId,
        powerIndexOf(cardId, PowerTiming.Action),
        [],
        modifiers
    )

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

const IN_USE = (cardId: string) =>
    `${cardId} is a modifier in use and cannot be discarded during the action it modifies`

const worldDeck = (s: HydratedOathGameState) => s.requireVault().worldDeck
const pile = (s: HydratedOathGameState, at: Region) => s.requireVault().discardPiles[at]

describe('Oracle declares the Cracked Horn, and the Vision discarded goes under the world deck (revision 31)', () => {
    it('the use is accepted, carries the Horn to the play, and records it in use', () => {
        const s = table(FIXED)
        expect(reasonOf(s, [HORN_USE])).toBeUndefined()
        const use = used(s, [HORN_USE])
        expect(s.getPlayerState('dana').knownHand()).toEqual([SUPREMACY])
        expect(s.pendingSearchModifiers).toEqual([
            { cardId: HORN, powerIndex: HORN_USE.powerIndex }
        ])
        expect(s.searchModifiersInUse).toEqual([HORN])
        expect(use.metadata?.modifiers).toEqual([HORN])
        // R-7.1.2 — Oracle's two secrets; the Horn costs nothing, and nothing else is charged.
        expect(s.getPlayerState('dana').secrets).toBe(1)
        expect(s.getPlayerState('dana').favor).toBe(3)
    })

    it('discarded, the Vision goes to the bottom of the world deck, and nothing stays in use', () => {
        const s = table(FIXED)
        used(s, [HORN_USE])
        const resolve = resolved(s, { play: SearchPlay.Discard })
        expect(worldDeck(s).at(-1)).toBe(SUPREMACY)
        expect(pile(s, Region.Provinces)).toEqual([])
        expect(resolve.metadata?.discardToWorldDeck).toBe(true)
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('control: with nothing declared, the Vision goes to the next region’s pile, as before', () => {
        const s = table(FIXED)
        const use = used(s)
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(use.metadata?.modifiers).toBeUndefined()
        resolved(s, { play: SearchPlay.Discard })
        expect(pile(s, Region.Provinces)).toEqual([SUPREMACY])
        expect(worldDeck(s)).not.toContain(SUPREMACY)
    })

    it('played, with the Horn, nothing is discarded and the Vision is revealed', () => {
        const s = table(FIXED)
        used(s, [HORN_USE])
        const resolve = resolved(s, { play: SearchPlay.RevealedVision })
        expect(s.getPlayerState('dana').revealedVisionId).toBe(SUPREMACY)
        expect(resolve.metadata?.discardedCardIds).toEqual([])
        expect(worldDeck(s)).toEqual([INN, FILLER])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('played over a revealed Vision, the old Vision goes under the world deck (R-5.1.4.III)', () => {
        const s = table(FIXED, { revealedVisionId: FAITH })
        used(s, [HORN_USE])
        resolved(s, { play: SearchPlay.RevealedVision })
        expect(s.getPlayerState('dana').revealedVisionId).toBe(SUPREMACY)
        expect(worldDeck(s).at(-1)).toBe(FAITH)
        expect(pile(s, Region.Provinces)).toEqual([])
    })
})

describe('Oracle declares Bracken, and the Vision discarded goes to the pile it names (revision 31)', () => {
    it('Bracken (the Cradle, bottom): the Vision goes to the bottom of the Cradle pile', () => {
        const s = table(FIXED)
        s.requireVault().discardPiles[Region.Cradle] = [WOLVES]
        s.discardPileCounts[Region.Cradle] = 1
        expect(reasonOf(s, [BRACKEN_CRADLE_BOTTOM])).toBeUndefined()
        const use = used(s, [BRACKEN_CRADLE_BOTTOM])
        expect(s.searchModifiersInUse).toEqual([BRACKEN])
        expect(use.metadata?.modifiers).toEqual([BRACKEN])
        const resolve = resolved(s, { play: SearchPlay.Discard })
        expect(pile(s, Region.Cradle)).toEqual([WOLVES, SUPREMACY])
        expect(pile(s, Region.Provinces)).toEqual([])
        expect(resolve.metadata?.discardPileRegion).toBe(Region.Cradle)
        expect(resolve.metadata?.discardToBottom).toBe(true)
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('at the adviser limit, the Vision kept as a facedown adviser cannot discard Bracken (R-7.4.3-H1)', () => {
        const s = table(FIXED, { advisers: [BRACKEN, WOLVES, ELDERS] })
        used(s, [BRACKEN_CRADLE_BOTTOM])
        const keep = (discarded: string) => ({
            play: SearchPlay.Adviser,
            discardedAdviserCardIds: [discarded]
        })
        const choice = (discarded: string) => ({
            keptCardId: SUPREMACY,
            discardOrder: [],
            ...keep(discarded)
        })
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice(BRACKEN))).toBe(
            IN_USE(BRACKEN)
        )
        expect(adviserLimitDiscards(s, 'dana')).not.toContain(BRACKEN)
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice(WOLVES))).toBeUndefined()
        resolved(s, keep(WOLVES))
        // Bracken covers the adviser discard too: the Wolves go to the bottom of the Cradle pile.
        expect(pile(s, Region.Cradle).at(-1)).toBe(WOLVES)
        expect(s.getPlayerState('dana').knownAdviserIds()).toEqual([BRACKEN, ELDERS, SUPREMACY])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('control: with nothing declared, Bracken may be the adviser discarded', () => {
        const s = table(FIXED, { advisers: [BRACKEN, WOLVES, ELDERS] })
        used(s)
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, 'dana', {
                keptCardId: SUPREMACY,
                discardOrder: [],
                play: SearchPlay.Adviser,
                discardedAdviserCardIds: [BRACKEN]
            })
        ).toBeUndefined()
    })
})

describe('what Oracle’s use refuses (revision 31)', () => {
    it('the Horn and Bracken together: refused (R-7.4-H2), and nothing is used or paid', () => {
        const s = table(FIXED)
        const reason = reasonOf(s, [HORN_USE, BRACKEN_CRADLE_BOTTOM])
        expect(reason).toContain('R-7.4-H2')
        expect(reasonOf(s, [BRACKEN_CRADLE_BOTTOM, HORN_USE])).toContain('R-7.4-H2')
        expect(() => used(s, [HORN_USE, BRACKEN_CRADLE_BOTTOM])).toThrow(reason)
        expect(s.getPlayerState('dana').secrets).toBe(3)
        expect(s.getPlayerState('dana').handIds).toEqual([])
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('a card that changes the draw (Augury) or the cost (News from Afar): refused', () => {
        const s = table(FIXED, { advisers: [BRACKEN, AUGURY, NEWS], favor: 4 })
        expect(reasonOf(s, [modifierUse(AUGURY)])).toBe(
            `${AUGURY} changes a Search's draw, and this power draws by its own text`
        )
        expect(reasonOf(s, [modifierUse(NEWS)])).toBe(
            `${NEWS} changes a Search's draw, and this power draws by its own text`
        )
        expect(reasonOf(s, [HORN_USE, modifierUse(AUGURY)])).toBeDefined()
        expect(() => used(s, [modifierUse(AUGURY)])).toThrow()
        expect(s.getPlayerState('dana').handIds).toEqual([])
    })

    it('a power that does not play "as if you searched" (Convoys) takes no modifier', () => {
        const s = table(FIXED, { atSite: [CONVOYS] })
        const convoys = [region(Region.Provinces)]
        const reasonFor = (modifiers: ModifierUse[]) =>
            HydratedUseActionPower.reasonCannotUse(
                s,
                'dana',
                CONVOYS,
                powerIndexOf(CONVOYS, PowerTiming.Action),
                convoys,
                modifiers
            )
        expect(reasonFor([])).toBeUndefined()
        expect(reasonFor([HORN_USE])).toBe(
            `${CONVOYS}'s power does not play or discard a card as if you searched, so it takes no modifier`
        )
    })

    it('a modifier Dana cannot reach: refused', () => {
        const s = table(FIXED, { advisers: [] })
        expect(reasonOf(s, [BRACKEN_CRADLE_BOTTOM])).toBe(
            `you neither rule ${BRACKEN} nor is your pawn at its site`
        )
    })
})

describe('Oracle with nothing left to draw opens no Search (revision 31)', () => {
    it('the Horn declared: nothing is set, carried or recorded', () => {
        const s = table(FIXED, { deck: [INN, FILLER] })
        const use = used(s, [HORN_USE])
        expect(use.metadata?.opensSearch).toBeUndefined()
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(use.metadata?.modifiers).toBeUndefined()
    })

    it('a modifier with a cost declared (Great Spire): nothing is charged for it', () => {
        const s = spireTable(3, [INN, FILLER])
        used(s, [SPIRE_USE])
        expect(s.getPlayerState('dana').secrets).toBe(1)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
    })
})

/** Great Spire (Cost: place 1 secret) at Dana's site: the one Search modifier with a cost this play accepts. */
function spireTable(secrets: number, deck?: string[]): HydratedOathGameState {
    const s = table(FIXED, { secrets, deck })
    placeEdifice(s, 'c1', GREAT_SPIRE)
    return s
}

describe('Oracle pays a declared modifier’s cost at its use (R-7.1.2)', () => {
    it('Great Spire’s secret is placed on it, with Oracle’s two', () => {
        const s = spireTable(3)
        expect(reasonOf(s, [SPIRE_USE])).toBeUndefined()
        const use = used(s, [SPIRE_USE])
        expect(s.getPlayerState('dana').secrets).toBe(0)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(use.metadata?.modifiers).toEqual([GREAT_SPIRE])
        expect(s.searchModifiersInUse).toEqual([GREAT_SPIRE])
    })

    it('refused when Oracle’s cost and the modifier’s cannot be paid in all, and nothing is paid', () => {
        const s = spireTable(2)
        expect(reasonOf(s, [])).toBeUndefined()
        expect(reasonOf(s, [SPIRE_USE])).toBe('costs 3 secrets in all, you hold 2')
        expect(() => used(s, [SPIRE_USE])).toThrow()
        expect(s.getPlayerState('dana').secrets).toBe(2)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
    })
})

describe('Forced Labor tolls Oracle as before, with a modifier declared (R-7.1.4)', () => {
    it('the toll goes to Rhys and the Horn still takes the discard', () => {
        const s = table(FIXED, { forcedLabor: true })
        const use = used(s, [HORN_USE])
        expect(use.metadata?.tollsGiven).toEqual([{ cardId: FORCED_LABOR, payeeId: 'rhys' }])
        expect(s.getPlayerState('rhys').favor).toBe(3)
        expect(s.getPlayerState('dana').favor).toBe(2)
        resolved(s, { play: SearchPlay.Discard })
        expect(worldDeck(s).at(-1)).toBe(SUPREMACY)
    })

    it('without a favor for the toll, the use is refused, with the Horn as without it', () => {
        const s = table(FIXED, { forcedLabor: true, favor: 0 })
        const plain = reasonOf(s, [])
        expect(plain).toBeDefined()
        expect(reasonOf(s, [HORN_USE])).toBe(plain)
    })
})

describe('Oracle before revision 31 takes no Search modifier (R-X.4)', () => {
    it('the Horn declared is refused, and nothing is used', () => {
        const s = table(BEFORE)
        expect(reasonOf(s, [HORN_USE])).toBe(
            'in a game created before revision 31, no Search modifier applies to a power’s play as if you searched'
        )
        expect(() => used(s, [HORN_USE])).toThrow()
        expect(s.getPlayerState('dana').handIds).toEqual([])
    })

    it('with nothing declared Oracle is unchanged: the Vision goes to the next region’s pile', () => {
        const s = table(BEFORE)
        const use = used(s)
        expect(use.metadata?.opensSearch).toBe(true)
        expect(use.metadata?.modifiers).toBeUndefined()
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
        resolved(s, { play: SearchPlay.Discard })
        expect(pile(s, Region.Provinces)).toEqual([SUPREMACY])
    })
})

describe('Oracle’s modifiers on Dana’s own view (the draw is hidden until made)', () => {
    it('the same answers, with neither the state copied nor changed', () => {
        const s = table(FIXED)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(reasonOf(own, [HORN_USE])).toBeUndefined()
        expect(reasonOf(own, [BRACKEN_CRADLE_BOTTOM])).toBeUndefined()
        expect(reasonOf(own, [HORN_USE, BRACKEN_CRADLE_BOTTOM])).toContain('R-7.4-H2')
        expect(reasonOf(own, [modifierUse(AUGURY)])).toBeDefined()
        expect(own.pendingSearchModifiers).toBeUndefined()
        expect(own.searchModifiersInUse).toBeUndefined()
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})

describe('Oracle’s modifiers end with its play, through the engine', () => {
    const search = (modifiers: ModifierUse[]) =>
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers
        })

    it('use, then discard: the machine returns to the Act Phase with nothing carried or in use', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED).dehydrate()
        state = engine.runNext(useAction([HORN_USE]), state, game).updatedState
        expect(state.machineState).toBe(MachineState.Searching)
        expect(state.searchModifiersInUse).toEqual([HORN])
        expect(state.pendingSearchModifiers).toHaveLength(1)
        const discard = buildAction(SearchResolve, {
            playerId: 'dana',
            keptCardId: SUPREMACY,
            discardOrder: [],
            play: SearchPlay.Discard
        })
        state = engine.runNext(discard, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.pendingSearchModifiers).toBeUndefined()
        expect(state.searchModifiersInUse).toBeUndefined()
        expect(new HydratedOathGameState(state).requireVault().worldDeck.at(-1)).toBe(SUPREMACY)
    })

    it('a Search after the use starts with its own record', () => {
        const s = table(FIXED, { advisers: [BRACKEN, AUGURY] })
        used(s, [HORN_USE])
        resolved(s, { play: SearchPlay.Discard })
        new HydratedSearch(search([modifierUse(AUGURY)])).apply(s)
        expect(s.searchModifiersInUse).toEqual([AUGURY])
        expect(s.pendingSearchModifiers).toBeUndefined()
    })

    it('the Vision kept as a facedown adviser, played later (R-6.1), takes only that play’s own modifiers', () => {
        const s = table(FIXED, { revealedVisionId: FAITH })
        used(s, [HORN_USE])
        resolved(s, { play: SearchPlay.Adviser })
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(s.pendingSearchModifiers).toBeUndefined()
        const plain = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'dana',
                cardId: SUPREMACY,
                play: SearchPlay.RevealedVision
            })
        )
        plain.apply(s)
        // Declared for Oracle's play alone, the Horn does not reach this one: Faith goes to the next region's pile.
        expect(plain.metadata?.modifiers).toBeUndefined()
        expect(pile(s, Region.Provinces)).toEqual([FAITH])
        expect(worldDeck(s)).not.toContain(FAITH)
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('Undo of the Vision kept facedown brings back the Search with the Horn still in use; the next play ends it', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED).dehydrate()
        const history: GameAction[] = []
        const run = (action: GameAction) => {
            const result = engine.runNext(action, state, game)
            history.push(...result.processedActions)
            state = result.updatedState
        }
        const resolve = (play: SearchPlay) =>
            buildAction(SearchResolve, {
                playerId: 'dana',
                keptCardId: SUPREMACY,
                discardOrder: [],
                play
            })
        run(useAction([HORN_USE]))
        run(resolve(SearchPlay.Adviser))
        expect(state.searchModifiersInUse).toBeUndefined()
        const target = latestPlayerUndoTarget(history, 'dana')
        expect(target?.type).toBe(ActionType.SearchResolve)
        assertExists(target)
        state = engine.undoProcessedAction({ state, action: target })
        expect(state.machineState).toBe(MachineState.Searching)
        expect(state.searchModifiersInUse).toEqual([HORN])
        expect(state.pendingSearchModifiers).toHaveLength(1)
        run(resolve(SearchPlay.Discard))
        expect(state.searchModifiersInUse).toBeUndefined()
        expect(state.pendingSearchModifiers).toBeUndefined()
        expect(new HydratedOathGameState(state).requireVault().worldDeck.at(-1)).toBe(SUPREMACY)
    })
})
