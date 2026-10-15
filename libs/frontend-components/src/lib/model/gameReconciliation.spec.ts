import { describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    createPatch,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'
import { GameActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'
import { GameReconciliation } from './gameReconciliation.js'

type State = GameState & { card?: string; effect?: string }
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

// The client clears a field by assigning undefined, as Sol's ActivateEffect does with the held card.
// The server's projected action carries a JSON forward patch, which removes the key instead.
function submission() {
    const before = stateWith({ card: 'Refraction' })
    const optimisticState = { ...before, card: undefined, effect: 'Accelerate', actionCount: 1 }
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
        const next: Record<string, unknown> = structuredClone(state)
        for (const op of patch ?? []) {
            const key = op.path.slice(1)
            if (op.op === 'remove') delete next[key]
            else next[key] = op.value
        }
        return next as State
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
        const { context, response, optimistic } = submission()
        const reconciliation = new GameReconciliation(context as unknown as Context)

        reconciliation.acceptSubmission('activate', response, optimistic)

        expect(context.restoreFrom).not.toHaveBeenCalled()
        expect(context.upsertAction).toHaveBeenCalledOnce()
    })
})
