import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import type { ShopId } from '../components/board.js'
import { ActionType } from '../definition/actions.js'
import type { MarracashProjectedState } from '../model/gameState.js'
import type { MarracashGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { MarracashInfo } from '../definition/info.js'
import { MarracashRuntime } from '../definition/runtime.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<MarracashGameConfig> = {}) {
    return MarracashRuntime.initializer.initializeGame(
        {
            id: 'marracash-test',
            typeId: MarracashInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(MarracashInfo.configurator?.options ?? []),
                ...config
            }),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type TestGame = ReturnType<typeof createGame>

export function startTestGame(count: number, config: Partial<MarracashGameConfig> = {}) {
    const game = createGame(count, config)
    const engine = new GameEngine(MarracashRuntime)
    const { initialState } = engine.startGame(game, { masterSeed: TestMasterSeed })
    return createTestSession(game, initialState)
}

export function createTestSession(game: TestGame, initialState: MarracashProjectedState) {
    const engine = new GameEngine(MarracashRuntime)
    let state = initialState
    let actionCount = 0

    function act(playerId: string, type: ActionType, payload: Record<string, unknown> = {}) {
        const action: GameAction = {
            id: `test-${actionCount++}`,
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        state = result.updatedState
        return result.processedActions
    }

    return {
        game,
        get state() {
            return state
        },
        set state(next: MarracashProjectedState) {
            state = next
        },
        hydrated() {
            return MarracashRuntime.hydrator.hydrateState(structuredClone(state))
        },
        currentPlayerId() {
            return state.activePlayerIds[0]
        },
        act,
        startAuction(playerId: string, shopId: ShopId) {
            return act(playerId, ActionType.StartAuction, { shopId })
        },
        bid(playerId: string, amount: number) {
            return act(playerId, ActionType.PlaceBid, { amount })
        }
    }
}

export type TestSession = ReturnType<typeof createTestSession>
