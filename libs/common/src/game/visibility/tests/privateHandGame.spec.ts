import { describe, expect, expectTypeOf, it } from 'vitest'
import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { Compile } from 'typebox/compile'
import { createGameFork, GameForkError } from '../../engine/gameFork.js'
import { getPrng } from '../../../util/prng.js'
import { assertExists } from '../../../util/assertions.js'
import * as Visibility from '../index.js'
import {
    CanonicalValidator,
    SharedValidator,
    HydratedPrivateHandState,
    createPrivateHandGame,
    requireCanonical,
    runtime,
    projector,
    p1,
    p2,
    spectator,
    populate,
    type CanonicalState,
    type SharedState
} from './privateHandGame.js'

describe('shared hydration for private hands', () => {
    it('keeps canonical fields required and derives optional projected fields', () => {
        expectTypeOf<SharedState['players'][number]['hand']>().toEqualTypeOf<
            CanonicalState['players'][number]['hand'] | undefined
        >()
        expectTypeOf<SharedState['secretBonus']>().toEqualTypeOf<number | undefined>()
        const { state } = createPrivateHandGame()
        const view = projector.project(state, p1)
        expect(CanonicalValidator.Check(state)).toBe(true)
        expect(CanonicalValidator.Check(view)).toBe(false)
        expect(SharedValidator.Check(state)).toBe(true)
        expect(SharedValidator.Check(view)).toBe(true)
    })

    it.each([p1, p2, spectator])(
        'preserves exact omissions and nested methods for $kind $playerId',
        (perspective) => {
            const { state } = createPrivateHandGame()
            const view = projector.project(state, perspective)
            expect(Value.Equal(new HydratedPrivateHandState(state).dehydrate(), state)).toBe(true)
            const hydrated = new HydratedPrivateHandState(view)
            expect(Value.Equal(hydrated.dehydrate(), view)).toBe(true)
            for (const player of hydrated.players) {
                if (perspective.kind === 'player' && perspective.playerId === player.playerId) {
                    expect(player.knownHand().cards[0].matches(hydrated.table[0])).toBe(true)
                } else {
                    expect(Object.hasOwn(player, 'hand')).toBe(false)
                }
            }
        }
    )

    it('discovers legal plays from the owner hand without accessing other hands', () => {
        const { game, state, engine } = createPrivateHandGame()
        const view = projector.project(state, p1)
        const guarded = projector.guardForExecution(new HydratedPrivateHandState(view), p1)
        expect(guarded.choices('p1')).toEqual(['r1'])
        expect(engine.getValidActionTypesForPlayer(game, view, 'p1', { perspective: p1 })).toEqual([
            'play',
            'draw'
        ])
        expect(
            engine.getValidActionTypesForPlayer(game, projector.project(state, spectator), 'p1', {
                perspective: spectator
            })
        ).toEqual([])
        expect(() => guarded.choices('p2')).toThrow(Visibility.UnavailableProjectedValueError)
        expect(guarded.drawPile.count()).toBe(2)
        expect(() => guarded.drawPile.draw()).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => guarded.secretBonus).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it('does not grant access to another hand just because its data was supplied', () => {
        const { state } = createPrivateHandGame()
        const guarded = projector.guardForExecution(new HydratedPrivateHandState(state), p1)
        expect(() => guarded.getPlayerState('p2').hand).toThrow(
            Visibility.UnavailableProjectedValueError
        )
        expect(() => {
            guarded.getPlayerState('p2').hand = guarded.getPlayerState('p1').hand
        }).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it('rejects malformed visible cards and illegal known choices', () => {
        const { game, state, engine, firstPlay } = createPrivateHandGame()
        const view = projector.project(state, p1)
        const invalid = structuredClone(view)
        const hand = invalid.players[0].hand
        expect(hand).toBeDefined()
        if (hand) Reflect.deleteProperty(hand.cards[0], 'rank')
        expect(() => new HydratedPrivateHandState(invalid)).toThrow()
        const illegal = { ...firstPlay, cardId: 'b1' }
        expect(() =>
            engine.executeAction({ game, state: view, action: illegal, perspective: p1 })
        ).toThrow()
    })

    it('uses canonical gates for execution and real Forks with the broader hydrator', () => {
        const { game, state, engine, firstPlay } = createPrivateHandGame()
        const view = projector.project(state, p1)
        expect(() =>
            engine.executeCanonicalAction({ game, state: view, action: firstPlay })
        ).toThrow('Complete canonical state is required')
        expect(() =>
            createGameFork({ game, state: view, actions: [], actionIndex: -1, runtime })
        ).toThrow(GameForkError)
        const result = engine.executeCanonicalAction({ game, state, action: firstPlay })
        const fork = createGameFork({
            game,
            state: result.updatedState,
            actions: result.processedActions,
            actionIndex: -1,
            runtime
        })
        expect(CanonicalValidator.Check(fork.state)).toBe(true)
        expect({ ...fork.state, gameId: game.id }).toEqual(state)
    })

    it('matches canonical execution and round-trips projected delivery and Undo', () => {
        assertExists(runtime.visibility, 'The fixture requires visibility')
        const { game, state, engine, firstPlay } = createPrivateHandGame()
        const canonical = engine.executeCanonicalAction({ game, state, action: firstPlay })
        requireCanonical(canonical.updatedState)
        const local = engine.executeAction({
            game,
            state: projector.project(state, p1),
            action: firstPlay,
            perspective: p1
        })
        expect(local.updatedState).toEqual(projector.project(canonical.updatedState, p1))
        for (const perspective of [p1, p2, spectator]) {
            const view = projector.project(state, perspective)
            const projected = Visibility.projectActionCascade(canonical.actionCascade, {
                visibility: runtime.visibility,
                perspective,
                replay: { game, runtime }
            })
            let replayed: SharedState = view
            for (const action of projected.actions)
                replayed = engine.applyProcessedAction({ game, state: replayed, action })
            expect(replayed).toEqual(projector.project(canonical.updatedState, perspective))
            for (const action of projected.actions.toReversed())
                replayed = engine.undoProcessedAction({ state: replayed, action })
            expect(replayed).toEqual(view)
        }
    })

    it('populates hypothetical hands using only known cards and public counts', () => {
        const { state } = createPrivateHandGame()
        const view = projector.project(state, p1)
        const first = populate(view, getPrng(123))
        state.players[1].hand.cards.reverse()
        state.drawPile.items.reverse()
        state.secretBonus = 9
        const second = populate(projector.project(state, p1), getPrng(123))
        expect(first).toEqual(second)
        expect(first.players[0].hand).toEqual(view.players[0].hand)
        expect(CanonicalValidator.Check(first)).toBe(true)
        expect(
            [...first.table, ...first.players.flatMap((p) => p.hand.cards), ...first.drawPile.items]
                .map((card) => card.id)
                .sort()
        ).toEqual(['b1', 'b2', 'b3', 'r1', 'r2', 'r3', 'r4'])
    })
})

describe('owner visibility contract', () => {
    it('uses the immediate containing player rather than the action actor', () => {
        const schema = Type.Object({
            playerId: Type.String(),
            target: Type.Object({
                playerId: Type.String(),
                hand: Visibility.protect(Type.Array(Type.String()), {
                    policy: Visibility.Policy.Owner
                })
            })
        })
        const projection = Visibility.createProjector(schema)
        const source = { playerId: 'p1', target: { playerId: 'p2', hand: ['secret'] } }
        expect(projection.project(source, p1).target).toEqual({ playerId: 'p2' })
        const view = projection.project(source, p2)
        expect(projection.guardForExecution(view, p2).target.hand).toEqual(['secret'])
    })

    it('rejects an owner policy with no containing player identity', () => {
        const projection = Visibility.createProjector(
            Type.Object({
                hand: Visibility.protect(Type.Array(Type.String()), {
                    policy: Visibility.Policy.Owner
                })
            })
        )
        expect(() => projection.project({ hand: [] }, p1)).toThrow('public playerId')
    })

    it('keeps arbitrary custom policies unavailable to projected execution', () => {
        const projection = Visibility.createProjector(
            Type.Object({
                hand: Visibility.protect(Type.Array(Type.String()), { policy: 'custom.owner' })
            }),
            { policies: { 'custom.owner': () => true } }
        )
        const view = projection.project({ hand: ['visible'] }, p1)
        expect(Compile(projection.schema).Check(view)).toBe(true)
        expect(() => projection.guardForExecution(view, p1).hand).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })
})
