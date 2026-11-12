import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { cashOwnedBy, getCompany } from '@tabletop/18xx'
import { Definition, EighteenNinetyFourTitleRules } from '../src/definition/gameDefinition.js'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from '../src/state.js'

export type TestTable = {
    game: Game
    engine: GameEngine<EighteenNinetyFourState, HydratedEighteenNinetyFourState>
    readonly state: EighteenNinetyFourState
    readonly hydrated: HydratedEighteenNinetyFourState
    actions: GameAction[]
    /** Takes an action as the first active player, or the given player. */
    act(type: string, fields?: object, playerId?: string): EighteenNinetyFourState
    validActions(playerId?: string): string[]
    cash(playerId: string): number
    companyCash(companyId: string): number
}

export function startTable(count = 4, seed = 11): TestTable {
    const engine = new GameEngine(Definition.runtime)
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: '1894-test',
            typeId: '1894',
            ownerId: 'p1',
            seed,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index + 1}`,
                userId: `p${index + 1}`,
                name: `Player ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(
        game,
        seed.toString(16).padStart(32, '0')
    )
    let state = initialState
    const actions: GameAction[] = []
    const hydrate = () => Definition.runtime.hydrator.hydrateState(structuredClone(state))
    return {
        game: startedGame,
        engine,
        actions,
        get state() {
            return state
        },
        get hydrated() {
            return hydrate()
        },
        act(type, fields = {}, playerId) {
            const actor = playerId ?? state.activePlayerIds[0]
            assertExists(actor, 'An action needs an active player')
            const action: GameAction = {
                id: `test:${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: actor,
                type,
                ...fields
            }
            const result = engine.executeCanonicalAction({ game: startedGame, state, action })
            state = result.updatedState
            actions.push(...result.processedActions)
            return state
        },
        validActions(playerId) {
            const actor = playerId ?? state.activePlayerIds[0]
            assertExists(actor, 'A player is active')
            return engine.getValidActionTypesForPlayer(startedGame, state, actor)
        },
        cash(playerId) {
            const cash = cashOwnedBy(hydrate(), { kind: 'player', playerId })
            return typeof cash === 'number' ? cash : 0
        },
        companyCash(companyId) {
            getCompany(hydrate(), companyId)
            const cash = cashOwnedBy(hydrate(), { kind: 'company', companyId })
            return typeof cash === 'number' ? cash : 0
        }
    }
}

export { EighteenNinetyFourTitleRules }
