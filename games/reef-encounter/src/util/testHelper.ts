import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { ReefEncounterGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { ReefEncounterInfo } from '../definition/info.js'
import { ReefEncounterRuntime } from '../definition/runtime.js'
import type { CoralColor } from '../components/colors.js'
import type { ReefEncounterProjectedState } from '../model/gameState.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<ReefEncounterGameConfig> = {}) {
    return ReefEncounterRuntime.initializer.initializeGame(
        {
            id: 'reef-encounter-test',
            typeId: ReefEncounterInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(ReefEncounterInfo.configurator?.options ?? []),
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

export function startTestGame(
    count: number,
    config: Partial<ReefEncounterGameConfig> = {},
    masterSeed: string = TestMasterSeed
) {
    const engine = new GameEngine(ReefEncounterRuntime)
    const { initialState, startedGame } = engine.startGame(createGame(count, config), {
        masterSeed
    })
    return createTestSession(startedGame, initialState)
}

export function createTestSession(game: TestGame, initialState: ReefEncounterProjectedState) {
    const engine = new GameEngine(ReefEncounterRuntime)
    let state = initialState
    let actionCount = 0
    const actions: GameAction[] = []

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
        actions.push(...result.processedActions)
        return result.processedActions
    }

    return {
        game,
        actions,
        initialState,
        get state() {
            return state
        },
        hydrated() {
            return ReefEncounterRuntime.hydrator.hydrateState(structuredClone(state))
        },
        currentPlayerId() {
            return state.activePlayerIds[0]
        },
        act,
        feedParrotfish(playerId: string, color: CoralColor) {
            return act(playerId, ActionType.FeedParrotfish, { color })
        },
        chooseLarvaCubes(playerId: string, colors: CoralColor[]) {
            return act(playerId, ActionType.ChooseLarvaCubes, { colors })
        }
    }
}

export type TestSession = ReturnType<typeof createTestSession>
