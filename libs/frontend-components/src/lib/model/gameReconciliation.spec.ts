import { describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    createPatch,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'
import { GameActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'
import { GameReconciliation, ServerActionHandling } from './gameReconciliation.js'

type State = GameState & { card?: string; effect?: string; cubes?: (string | null | undefined)[] }
type Context = GameContext<State, HydratedGameState<State> & State>

function stateWith(fields: Partial<State>): State {
    return {
        systemVersion: 3,
        id: 'state',
        gameId: 'game',
        activePlayerIds: ['p1'],
        winningPlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        ...fields
    } as State
}

// The server's projected action carries a JSON forward patch built from the State as it is stored.
function submission(before: State, optimisticState: State) {
    const action: GameAction = {
        id: 'activate',
        gameId: 'game',
        type: 'ActivateEffect',
        playerId: 'p1',
        source: ActionSource.User,
        index: 0
    }
    const served: GameAction = {
        ...action,
        forwardPatch: createPatch(before, JSON.parse(JSON.stringify(optimisticState)))
    }
    const applyPatch = (state: State, patch: GameAction['forwardPatch']) => {
        const next = structuredClone(state)
        for (const op of patch ?? []) {
            const keys = op.path.slice(1).split('/')
            const last = keys.pop() as string
            const parent = keys.reduce<Record<string, unknown>>(
                (node, key) => node[key] as Record<string, unknown>,
                next as Record<string, unknown>
            )
            if (op.op === 'remove') delete parent[last]
            else parent[last] = 'value' in op ? op.value : undefined
        }
        return next
    }
    const context = {
        state: optimisticState,
        game: {},
        applyActionResults: vi.fn(),
        engine: {
            applyProcessedAction: ({ action, state }: { action: GameAction; state: State }) =>
                applyPatch(state, action.forwardPatch)
        },
        restoreFrom: vi.fn(),
        upsertAction: vi.fn(),
        verifyFullChecksum: vi.fn()
    }
    const response = { actions: [served] } as unknown as Awaited<
        ReturnType<RemoteApiService['applyAction']>
    >
    return {
        context,
        response,
        optimistic: {
            before: { state: before, game: {} } as unknown as Context,
            result: new GameActionResults<State>([action], optimisticState)
        }
    }
}

describe('GameReconciliation.acceptSubmission', () => {
    it('keeps an optimistic State whose cleared field the server removed', () => {
        // Sol's ActivateEffect clears the held card by assigning undefined
        const before = stateWith({ card: 'Refraction' })
        const { context, response, optimistic } = submission(before, {
            ...before,
            card: undefined,
            effect: 'Accelerate',
            actionCount: 1
        })
        const reconciliation = new GameReconciliation(context as unknown as Context)

        reconciliation.acceptSubmission('activate', response, optimistic)

        expect(context.restoreFrom).not.toHaveBeenCalled()
        expect(context.upsertAction).toHaveBeenCalledOnce()
    })

    it('keeps an optimistic State whose cleared array slot the server sent as null', () => {
        // Estates' startAuction takes a cube off the board, leaving undefined in its slot
        const before = stateWith({ cubes: ['red', null] })
        const { context, response, optimistic } = submission(before, {
            ...before,
            cubes: [undefined, null],
            actionCount: 1
        })
        const reconciliation = new GameReconciliation(context as unknown as Context)

        reconciliation.acceptSubmission('activate', response, optimistic)

        expect(context.restoreFrom).not.toHaveBeenCalled()
    })

    it('replaces an optimistic State that differs from the server', () => {
        const before = stateWith({ card: 'Refraction' })
        const { context, response, optimistic } = submission(before, {
            ...before,
            card: undefined,
            actionCount: 1
        })
        optimistic.result.updatedState = { ...optimistic.result.updatedState, card: 'Flare' }
        const reconciliation = new GameReconciliation(context as unknown as Context)

        reconciliation.acceptSubmission('activate', response, optimistic)

        expect(context.restoreFrom).toHaveBeenCalledOnce()
    })
})

// The player placed a piece (action 0) and undid it; the server's broadcast of the placement can
// still arrive afterwards, carrying the game record as it stood before the undo.
function afterUndo() {
    const placedAt = new Date('2026-10-14T21:00:00.000Z')
    const undoneAt = new Date('2026-10-14T21:00:01.000Z')
    const game = { id: 'game', updatedAt: undoneAt } as Game
    const context = {
        state: stateWith({ actionCount: 0 }),
        game,
        historyStartIndex: 0,
        hasAction: () => false,
        applyActionResults: vi.fn(),
        updateGame: vi.fn(),
        restoreFrom: vi.fn(),
        nextActionIndex: 0,
        actions: [],
        engine: {
            applyProcessedAction: ({ state }: { state: State }) => ({
                ...state,
                actionCount: state.actionCount + 1
            })
        }
    }
    const clone = () => ({
        ...context,
        state: structuredClone(context.state),
        nextActionIndex: context.nextActionIndex,
        applyActionResults(results: { updatedState: State }) {
            this.state = results.updatedState
            this.nextActionIndex += 1
        },
        verifyFullChecksum: () => {},
        updateGame: () => {}
    })
    Object.assign(context, { clone })
    const remote = {
        isPaused: () => false,
        recover: vi.fn(),
        acceptsPerspective: () => true
    }
    const placement: GameAction = {
        id: 'place',
        gameId: 'game',
        type: 'PlaceCity',
        playerId: 'p1',
        source: ActionSource.User,
        index: 0
    }
    const broadcast = (updatedAt: Date) => ({
        kind: 'actions' as const,
        actions: [placement],
        handling: ServerActionHandling.ApplyProcessed,
        game: { ...game, updatedAt }
    })
    const reconciliation = new GameReconciliation(
        context as unknown as Context,
        remote as unknown as ConstructorParameters<
            typeof GameReconciliation<State, HydratedGameState<State> & State>
        >[1]
    )
    // An earlier Undo's push: the game as it stood with the placement still in it.
    const replacement = (updatedAt: Date) => ({
        kind: 'replacement' as const,
        replay: { startIndex: 0, actions: [placement] },
        checksum: 0,
        game: { ...game, updatedAt },
        perspective: { kind: 'player' as const, playerId: 'p1' }
    })
    return { context, reconciliation, broadcast, replacement, placedAt, undoneAt }
}

describe('GameReconciliation server updates', () => {
    it('ignores the broadcast of an action the player has since undone', async () => {
        const { context, reconciliation, broadcast, placedAt } = afterUndo()

        await reconciliation.enqueue(broadcast(placedAt))

        expect(context.applyActionResults).not.toHaveBeenCalled()
        expect(context.updateGame).not.toHaveBeenCalled()
    })

    it('ignores a replacement older than the game it has', async () => {
        const { context, reconciliation, replacement, placedAt } = afterUndo()

        await reconciliation.enqueue(replacement(placedAt))

        expect(context.restoreFrom).not.toHaveBeenCalled()
    })

    it('applies a broadcast newer than the game it has', async () => {
        const { context, reconciliation, broadcast, undoneAt } = afterUndo()

        await reconciliation.enqueue(broadcast(new Date(undoneAt.getTime() + 1000)))

        expect(context.applyActionResults).toHaveBeenCalledOnce()
    })
})

// The player undid an action; the client already shows the result, and the server's push of the
// Undo to the same player replays exactly that history.
class FakeContext {
    historyStartIndex = 0
    updateGame = vi.fn()
    restoreFrom = vi.fn()
    verifyFullChecksum = () => {}

    constructor(
        public state: State,
        public actions: GameAction[],
        readonly game: Game,
        readonly engine: { applyProcessedAction(input: { action: GameAction; state: State }): State }
    ) {}

    get nextActionIndex() {
        return this.actions.length
    }

    undoLastAction() {
        this.actions = this.actions.slice(0, -1)
        this.state = stateWith({ actionCount: this.actions.length })
    }

    applyActionResults(results: { processedActions: GameAction[]; updatedState: State }) {
        this.actions = [...this.actions, ...results.processedActions]
        this.state = results.updatedState
    }

    clone(): FakeContext {
        return new FakeContext(structuredClone(this.state), [...this.actions], this.game, this.engine)
    }
}

function afterOwnUndo(replayedRank: number) {
    const game = { id: 'game', updatedAt: new Date('2026-10-14T21:00:01.000Z') } as Game
    const kept: GameAction = {
        id: 'kept',
        gameId: 'game',
        type: 'Build',
        playerId: 'p1',
        source: ActionSource.User,
        index: 0
    }
    const engine = {
        applyProcessedAction: ({ state }: { action: GameAction; state: State }) =>
            ({ ...state, actionCount: state.actionCount + 1, rank: replayedRank }) as State
    }
    const shown = { ...stateWith({ actionCount: 1 }), rank: 0 } as State
    const context = new FakeContext(shown, [kept], game, engine)
    const reconciliation = new GameReconciliation(context as unknown as Context)
    return { context, reconciliation, replay: { startIndex: 0, actions: [kept] }, game }
}

describe('GameReconciliation.replace', () => {
    it('keeps the current State when the replay rebuilds exactly what the client has', () => {
        const { context, reconciliation, replay, game } = afterOwnUndo(0)

        reconciliation.replace(replay, 0, game)

        expect(context.restoreFrom).not.toHaveBeenCalled()
        expect(context.updateGame).toHaveBeenCalledWith(game)
    })

    it('replaces the State when the replay rebuilds something different', () => {
        const { context, reconciliation, replay, game } = afterOwnUndo(2)

        reconciliation.replace(replay, 0, game)

        expect(context.restoreFrom).toHaveBeenCalledOnce()
    })
})
