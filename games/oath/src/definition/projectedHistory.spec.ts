import { describe, expect, it } from 'vitest'
import { GameStatus, Visibility, assert, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { waitingGame } from '../testing/game.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import { MachineState } from './states.js'
import { HydratedOathGameState, OathGameStateValidator, type OathGameState, type OathProjectedState } from '../model/gameState.js'
import { SetupVariant } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { Peek, PeekTargetKind } from '../actions/peek.js'
import { Travel } from '../actions/travel.js'
import { LetPeek, LetPeekSubjectKind } from '../actions/letPeek.js'
import { Search, SearchSource } from '../actions/search.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { modifierUse } from '../testing/choices.js'

// R-9.4 — what each seat is sent, action by action, rebuilds the state it is shown.
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const DOWSING_STICKS = 'relic.dowsing-sticks'
const HARP = 'relic.truthful-harp'

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

/** A protected three-seat game, set up and into the Chancellor's first Act Phase. */
function table() {
    const game = { ...waitingGame(3, { setupVariant: SetupVariant.Randomized }), status: GameStatus.Started, protectedInformation: true as const }
    let state = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    while (state.machineState === MachineState.Setup) {
        const hydrated = new HydratedOathGameState(state)
        const [playerId] = state.activePlayerIds
        const hand = hydrated.getPlayerState(playerId).knownHand()
        state = engine.runNext(buildAction(SetupChoice, {
            playerId,
            siteId: playerId === state.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1],
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        }), state, game).updatedState
    }
    const [chancellor] = state.activePlayerIds
    if (state.machineState === MachineState.WakePhase)
        state = engine.runNext(buildAction(ResolveWake, { playerId: chancellor, favorSteps: [] }), state, game).updatedState
    const [, other, third] = state.turnManager.turnOrder
    return { game, state: canonical(state), chancellor, other, third }
}

function perspectivesOf(state: OathGameState): Visibility.Perspective[] {
    return [...state.players.map((player) => ({ kind: 'player', playerId: player.playerId }) as const), { kind: 'spectator' }]
}

function project(state: OathGameState, perspective: Visibility.Perspective): OathProjectedState {
    return OathVisibility.state.project(state, perspective)
}

describe('projected history around Peek, LetPeek, Search and SearchResolve', () => {
    it('replays to each seat’s view of the result, and undoes back to its view of the start', () => {
        const { game, state: start, chancellor, other } = table()
        const actions: GameAction[] = []
        let state: OathGameState = start
        const run = (action: GameAction) => {
            const result = engine.executeCanonicalAction({ action: { ...action, id: `h-${state.actionCount}`, index: state.actionCount }, state, game })
            actions.push(...result.processedActions)
            state = canonical(result.updatedState)
        }

        const hydrated = new HydratedOathGameState(state)
        const siteId = hydrated.faceupSiteIds().find((id) => hydrated.relicSlotsAt(id).length > 0)
        assert(siteId !== undefined, 'a faceup site holds a relic')
        const [slot] = hydrated.relicSlotsAt(siteId)
        if (hydrated.getPlayerState(chancellor).siteId !== siteId)
            run(buildAction(Travel, { playerId: chancellor, siteId }))
        run(buildAction(Peek, { playerId: chancellor, target: { kind: PeekTargetKind.SiteRelic, slotId: slot.slotId } }))
        const [adviser] = hydrated.getPlayerState(chancellor).knownAdviserIds()
        run(buildAction(LetPeek, { playerId: chancellor, outOfTurn: true, sequenced: true, toPlayerId: other, subject: { kind: LetPeekSubjectKind.Adviser, cardId: adviser } }))
        run(buildAction(Search, { playerId: chancellor, drawFrom: SearchSource.WorldDeck, revealsInfo: true }))
        const hand = new HydratedOathGameState(state).getPlayerState(chancellor).knownHand()
        run(buildAction(SearchResolve, { playerId: chancellor, keptCardId: hand[0], discardOrder: hand.slice(1), play: SearchPlay.Discard }))
        expect(actions.map((action) => action.type)).toEqual(expect.arrayContaining(['peek', 'letPeek', 'search', 'searchResolve']))

        for (const perspective of perspectivesOf(state)) {
            const history = Visibility.projectActionHistory({
                game,
                currentState: state,
                startIndex: start.actionCount,
                actions,
                visibility: OathVisibility,
                perspective,
                replay: { game, runtime: OathRuntime }
            })
            // A client applies each record by its patches, so none is hydrated from its projected fields.
            for (const action of history.actions) {
                expect(action.forwardPatch).toBeDefined()
                expect(action.undoPatch).toBeDefined()
            }
            let view = project(start, perspective)
            for (const action of history.actions) view = engine.applyProcessedAction({ game, state: view, action })
            expect(view).toEqual(project(state, perspective))
            for (const action of history.actions.toReversed()) view = engine.undoProcessedAction({ state: view, action })
            expect(view).toEqual(project(start, perspective))
        }
    })
})

describe('hydrating a projection', () => {
    it('carries a shown adviser row and a pending question for every seat and a spectator', () => {
        const { game, state: start, chancellor, other } = table()
        const hydrated = new HydratedOathGameState(structuredClone(start))
        const [adviser] = hydrated.getPlayerState(chancellor).knownAdviserIds()
        let state = canonical(engine.runNext(buildAction(LetPeek, { playerId: chancellor, outOfTurn: true, sequenced: true, toPlayerId: other, subject: { kind: LetPeekSubjectKind.Adviser, cardId: adviser } }), start, game).updatedState)

        // Dowsing Sticks from the relic deck, as though the Chancellor held it.
        const relicDeck = state.vault.relicDeck
        const at = relicDeck.indexOf(DOWSING_STICKS)
        const [sticks] = at >= 0 ? relicDeck.splice(at, 1) : [DOWSING_STICKS]
        if (at < 0) {
            const slotId = Object.keys(state.vault.relicFacedown).find((id) => state.vault.relicFacedown[id] === DOWSING_STICKS)
            assert(slotId !== undefined, 'Dowsing Sticks is somewhere in the vault')
            const [replacement] = relicDeck.splice(0, 1)
            state.vault.relicFacedown[slotId] = replacement
            for (const player of state.players) if (player.peekedRelics[slotId]) player.peekedRelics[slotId] = replacement
        }
        state.players.find((player) => player.playerId === chancellor)?.relicIds.push(sticks)
        state = canonical(engine.runNext(buildAction(UseActionPower, { playerId: chancellor, cardId: DOWSING_STICKS, powerIndex: powerIndexOf(DOWSING_STICKS, PowerTiming.Action) }), canonical(state), game).updatedState)
        expect(state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, askedPlayerId: chancellor })

        for (const perspective of perspectivesOf(state)) {
            const view = project(state, perspective)
            const holder = OathRuntime.hydrator.hydrateState(view).getPlayerState(chancellor)
            expect(holder.advisers[0].shownTo).toEqual([other])
            const seesShown = perspective.kind === 'player' && perspective.playerId === other
            expect(holder.advisers[0].shownCardId !== undefined).toBe(seesShown)
            const asked = perspective.kind === 'player' && perspective.playerId === chancellor
            expect(view.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.KeepOrBottomRelic)
            expect(Object.hasOwn(view.pendingQuestions?.queue[0] ?? {}, 'relicCardId')).toBe(asked)
        }
    })
})

describe('Truthful Harp keeps the order of its discards to the searcher', () => {
    it('two Searches that differ only in that order look the same to every other seat and a spectator, in state and in history', () => {
        const { game, state: start, chancellor } = table()
        const withHarp = structuredClone(start)
        const deck = withHarp.vault.relicDeck
        const at = deck.indexOf(HARP)
        if (at >= 0) deck.splice(at, 1)
        else {
            const slotId = Object.keys(withHarp.vault.relicFacedown).find((id) => withHarp.vault.relicFacedown[id] === HARP)
            assert(slotId !== undefined, 'Truthful Harp is somewhere in the vault')
            const [replacement] = deck.splice(0, 1)
            withHarp.vault.relicFacedown[slotId] = replacement
            for (const player of withHarp.players) if (player.peekedRelics[slotId]) player.peekedRelics[slotId] = replacement
        }
        withHarp.players.find((player) => player.playerId === chancellor)?.relicIds.push(HARP)
        // Denizens under the top card, so the draw runs its full length before any Vision stops it.
        const [top, ...rest] = withHarp.vault.worldDeck
        const next = rest.filter((cardId) => !cardId.startsWith('vision.')).slice(0, 5)
        withHarp.vault.worldDeck = [top, ...next, ...rest.filter((cardId) => !next.includes(cardId))]
        const execute = (action: GameAction, state: OathGameState) =>
            engine.executeCanonicalAction({ action: { ...action, id: `h-${state.actionCount}`, index: state.actionCount }, state, game })
        const searched = execute(buildAction(Search, { playerId: chancellor, drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(HARP)] }), canonical(withHarp))
        const searching = canonical(searched.updatedState)
        const hand = new HydratedOathGameState(searching).getPlayerState(chancellor).knownHand()
        expect(hand.length).toBeGreaterThan(2)
        const resolve = (discardOrder: string[]) =>
            execute(buildAction(SearchResolve, { playerId: chancellor, keptCardId: hand[0], discardOrder, play: SearchPlay.Site }), searching)
        const one = resolve(hand.slice(1))
        const two = resolve(hand.slice(1).toReversed())
        const oneState = canonical(one.updatedState)
        const twoState = canonical(two.updatedState)
        expect(oneState.vault.discardPiles).not.toEqual(twoState.vault.discardPiles)
        const seen = (history: readonly GameAction[]) =>
            history.map((action) => ({ type: action.type, metadata: Reflect.get(action, 'metadata'), forwardPatch: action.forwardPatch, undoPatch: action.undoPatch }))
        for (const perspective of perspectivesOf(oneState).filter((p) => p.kind !== 'player' || p.playerId !== chancellor)) {
            expect(project(oneState, perspective)).toEqual(project(twoState, perspective))
            const historyOf = (currentState: OathGameState, actions: readonly GameAction[]) =>
                Visibility.projectActionHistory({ game, currentState, startIndex: searching.actionCount, actions, visibility: OathVisibility, perspective, replay: { game, runtime: OathRuntime } }).actions
            expect(seen(historyOf(oneState, one.processedActions))).toEqual(seen(historyOf(twoState, two.processedActions)))
        }
    })
})
