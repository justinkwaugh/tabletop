import { describe, expect, it } from 'vitest'
import { assert, assertExists } from '../../util/assertions.js'
import { getPrng } from '../../util/prng.js'
import { ActionSource, type GameAction } from './gameAction.js'
import { ExplorationHistory } from './explorationHistory.js'
import { projectActionHistory } from '../visibility/gameVisibility.js'
import {
    CanonicalValidator,
    createPrivateHandGame,
    p2,
    populate,
    runtime,
    type SharedState
} from '../visibility/tests/privateHandGame.js'

function withoutExploration(state: SharedState): SharedState {
    const result = structuredClone(state)
    delete result.explorationState
    return result
}

function scenario() {
    const { game, state: initial, engine, firstPlay } = createPrivateHandGame()
    const result = engine.executeCanonicalAction({ game, state: initial, action: firstPlay })
    assertExists(runtime.visibility)
    const projected = projectActionHistory({
        currentState: result.updatedState,
        actions: result.processedActions,
        visibility: runtime.visibility,
        perspective: p2,
        replay: { game, runtime }
    })
    const source = projected.currentState
    const hypothetical = populate(source, getPrng(17))
    const history = new ExplorationHistory(engine)
    const exploration = history.checkpoint(source, hypothetical, projected.actions, game)
    const futureAction = {
        id: 'future-play',
        gameId: game.id,
        source: ActionSource.User,
        type: 'play',
        playerId: 'p2',
        cardId: 'r2'
    }
    return {
        game,
        initial,
        engine,
        source,
        hypothetical,
        history,
        exploration,
        actions: projected.actions,
        futureAction,
        recordedInitial: runtime.visibility.state.project(initial, p2)
    }
}

describe('Exploration boundary patches', () => {
    it('stores only differences, without recursive metadata or unchanged state', () => {
        const { source, hypothetical, history, exploration } = scenario()
        assertExists(exploration.checkpoint)
        const operations = [
            ...exploration.checkpoint.source,
            ...exploration.checkpoint.hypothetical
        ]
        expect(operations.some((operation) => operation.path === '')).toBe(false)
        expect(operations.some((operation) => operation.path.startsWith('/table'))).toBe(false)
        expect(JSON.stringify(operations)).not.toContain('explorationState')
        expect(JSON.stringify(operations).length).toBeLessThan(
            JSON.stringify([source, hypothetical]).length
        )
        expect(
            history.recordedState({ ...hypothetical, explorationState: exploration }, exploration)
        ).toEqual(source)
        expect(exploration.checkpoint.undoLimit).toBe(1)
    })

    it.each(['delta', 'legacy snapshots'] as const)(
        'round-trips history and future play using %s',
        (format) => {
            const {
                game,
                initial,
                engine,
                source,
                hypothetical,
                history,
                exploration,
                actions,
                futureAction,
                recordedInitial
            } = scenario()
            if (format === 'legacy snapshots') {
                exploration.checkpoint = {
                    source: [{ op: 'replace', path: '', value: source }],
                    hypothetical: [{ op: 'replace', path: '', value: hypothetical }],
                    undoLimit: 1
                }
            }
            const future = engine.executeCanonicalAction({
                game,
                state: { ...hypothetical, explorationState: exploration },
                action: futureAction
            })
            const loaded = JSON.parse(JSON.stringify(future.updatedState))
            assert(CanonicalValidator.Check(loaded))
            let current: SharedState = history.recordedState(loaded, exploration)
            for (let pass = 0; pass < 10; pass++) {
                for (const action of future.processedActions.toReversed())
                    current = history.backward(current, action, exploration)
                expect(current).toEqual(source)
                for (const action of actions.toReversed())
                    current = history.backward(current, action, exploration)
                expect(current).toEqual(recordedInitial)
                for (const action of actions)
                    current = history.forward(current, action, game, exploration)
                expect(current).toEqual(source)
                for (const action of future.processedActions)
                    current = history.forward(current, action, game, exploration)
                expect(withoutExploration(current)).toEqual(withoutExploration(future.updatedState))
            }
            expect(initial.drawPile.items).toHaveLength(2)
            expect(current.drawPile.items).toHaveLength(hypothetical.drawPile.items.length)
        }
    )

    it('crosses the boundary once when History starts at the source position', () => {
        const {
            game,
            engine,
            source,
            hypothetical,
            history,
            exploration,
            actions,
            futureAction,
            recordedInitial
        } = scenario()
        let current = history.recordedState(
            { ...hypothetical, explorationState: exploration },
            exploration
        )
        expect(current).toEqual(source)
        for (const action of actions.toReversed())
            current = history.backward(current, action, exploration)
        expect(current).toEqual(recordedInitial)
        for (const action of actions) current = history.forward(current, action, game, exploration)
        const future = engine.executeCanonicalAction({
            state: hypothetical,
            action: futureAction,
            game
        })
        for (const action of future.processedActions)
            current = history.forward(current, action, game, exploration)
        expect(current).toEqual(future.updatedState)
    })

    it('restores sampled fields after original patches replace whole objects', () => {
        const {
            game,
            engine,
            source,
            hypothetical,
            history,
            exploration,
            actions,
            futureAction,
            recordedInitial
        } = scenario()
        const replacement: GameAction = {
            ...actions[0],
            undoPatch: [{ op: 'replace', path: '', value: recordedInitial }],
            forwardPatch: [{ op: 'replace', path: '', value: source }]
        }
        let current = history.recordedState(hypothetical, exploration)
        current = history.backward(current, replacement, exploration)
        current = history.forward(current, replacement, game, exploration)
        expect(current).toEqual(source)
        const future = engine.executeCanonicalAction({
            state: hypothetical,
            action: futureAction,
            game
        })
        for (const action of future.processedActions)
            current = history.forward(current, action, game, exploration)
        expect(current).toEqual(future.updatedState)
    })

    it.each([false, true])(
        'rebases safe inherited Undo with a simulated suffix: %s',
        (withFuture) => {
            const { game, state: initial, engine, firstPlay } = createPrivateHandGame()
            const result = engine.executeCanonicalAction({
                game,
                state: initial,
                action: firstPlay
            })
            const source = result.updatedState
            const hypothetical = structuredClone(source)
            hypothetical.secretBonus = 5
            hypothetical.drawPile.items.reverse()
            const history = new ExplorationHistory(engine)
            const exploration = history.checkpoint(
                source,
                hypothetical,
                result.processedActions,
                game
            )
            expect(exploration.checkpoint?.undoLimit).toBe(0)
            let before = { ...hypothetical, explorationState: exploration }
            let removed = result.processedActions
            if (withFuture) {
                const action = {
                    id: 'future-play',
                    gameId: game.id,
                    type: 'play',
                    source: ActionSource.User,
                    playerId: 'p2',
                    cardId: 'r2'
                }
                const future = engine.executeCanonicalAction({ game, state: before, action })
                assertExists(future.updatedState.explorationState)
                before = {
                    ...future.updatedState,
                    explorationState: future.updatedState.explorationState
                }
                removed = [...removed, ...future.processedActions]
            }
            let after: SharedState = before
            for (const action of removed.toReversed())
                after = engine.undoProcessedAction({ state: after, action })
            const rebased = history.afterUndo(before, after, removed)
            expect(rebased.explorationState?.actionCount).toBe(0)
            expect(rebased.explorationState?.checkpoint?.undoLimit).toBe(0)
            expect(history.recordedState(rebased, rebased.explorationState)).toEqual(initial)
            const replay = engine.executeCanonicalAction({
                state: rebased,
                action: firstPlay,
                game
            })
            expect(withoutExploration(replay.updatedState)).toEqual(hypothetical)
            expect(
                rebased.explorationState?.checkpoint?.source.every(
                    (operation) => operation.path !== ''
                )
            ).toBe(true)
        }
    )

    it.each([false, true])(
        'rewinds canonical revealing history with a future suffix: %s',
        (withFuture) => {
            const { game, state: initial, engine } = createPrivateHandGame()
            const draw = {
                id: 'original-draw',
                gameId: game.id,
                type: 'draw',
                source: ActionSource.User,
                playerId: 'p1',
                revealsInfo: true
            }
            const result = engine.executeCanonicalAction({ game, state: initial, action: draw })
            const source = result.updatedState
            const history = new ExplorationHistory(engine)
            const hypothetical = history.prepareState(source)
            for (const player of hypothetical.players) player.hand?.cards.reverse()
            const exploration = history.checkpoint(
                source,
                hypothetical,
                result.processedActions,
                game,
                'canonical'
            )
            expect(exploration.checkpoint?.undoLimit).toBe(0)
            let before: SharedState = { ...hypothetical, explorationState: exploration }
            let removed = result.processedActions
            if (withFuture) {
                const action = {
                    id: 'future-play',
                    gameId: game.id,
                    type: 'play',
                    source: ActionSource.User,
                    playerId: 'p2',
                    cardId: 'r2'
                }
                const future = engine.executeCanonicalAction({ game, state: before, action })
                before = future.updatedState
                let boundary = before
                for (const action of future.processedActions.toReversed()) {
                    boundary = history.undo(boundary, action, exploration)
                }
                expect(history.afterUndo(before, boundary, future.processedActions)).toEqual({
                    ...hypothetical,
                    explorationState: exploration
                })
                removed = [...removed, ...future.processedActions]
            }
            const loaded = JSON.parse(JSON.stringify(before))
            assert(CanonicalValidator.Check(loaded))
            let after: SharedState = loaded
            for (const action of removed.toReversed())
                after = history.undo(after, action, exploration)
            const rebased = history.afterUndo(loaded, after, removed)
            engine.validateCanonicalState(rebased)
            expect(history.recordedState(rebased, rebased.explorationState)).toEqual(initial)
            expect(rebased.explorationState?.checkpoint?.canonicalSource).toBe(true)
            expect(rebased.prng.seed).not.toBe(initial.prng.seed)
            expect(rebased.players).toEqual(initial.players)
            expect([...rebased.drawPile.items].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
                [...initial.drawPile.items].sort((a, b) => a.id.localeCompare(b.id))
            )
            expect(
                engine.executeCanonicalAction({ game, state: rebased, action: draw }).updatedState
                    .actionCount
            ).toBe(1)
        }
    )

    it('retains inherited projected Undo limits when branching from a populated Exploration', () => {
        const { game, source, hypothetical, history, exploration, actions } = scenario()
        const branch = { ...hypothetical, explorationState: exploration }
        const checkpoint = history.checkpoint(
            branch,
            history.prepareState(branch),
            actions,
            game,
            'canonical'
        )
        expect(checkpoint.checkpoint?.undoLimit).toBe(exploration.checkpoint?.undoLimit)
        expect(source.actionCount).toBe(1)
    })

    it('leaves older Explorations without checkpoints on their existing history path', () => {
        const { game, engine, state, firstPlay } = createPrivateHandGame()
        const result = engine.executeCanonicalAction({ game, state, action: firstPlay })
        const history = new ExplorationHistory(engine)
        const legacy = { actionCount: 1, invocations: 0 }
        let current = history.recordedState(result.updatedState, legacy)
        for (const action of result.processedActions.toReversed())
            current = history.backward(current, action, legacy)
        expect(current).toEqual(state)
        for (const action of result.processedActions)
            current = history.forward(current, action, game, legacy)
        expect(current).toEqual(result.updatedState)
    })
})
