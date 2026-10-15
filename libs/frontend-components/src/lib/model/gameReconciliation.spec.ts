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
