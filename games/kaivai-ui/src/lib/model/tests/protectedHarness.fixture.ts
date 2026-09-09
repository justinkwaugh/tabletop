import {
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    createHarnessAppContext,
    GameSession,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { KaivaiRuntime, MachineState, Ruleset } from '@tabletop/kaivai'
import { UiDefinition } from '../../index.js'
import { KaivaiUiRuntime } from '../../definition/gameUiRuntime.js'

export const storageDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...KaivaiRuntime,
            sessionClass: GameSession,
            colorizer: KaivaiUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The storage fixture does not render a table')
                },
                mount: () => {
                    throw Error('The storage fixture does not render a table')
                }
            }
        }
    }
}

export async function saveProtectedHarnessGame(scoring: boolean) {
    const game: Game = {
        id: 'protected-kaivai',
        typeId: 'kaivai',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'harness-user',
        name: 'Protected Kaivai',
        players: ['p1', 'p2', 'p3'].map((id) => ({
            id,
            name: id,
            userId: 'harness-user',
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        config: { ruleset: Ruleset.FirstEdition, lucklessFishing: false },
        hotseat: true,
        storage: GameStorage.Local,
        winningPlayerIds: [],
        createdAt: new Date(0)
    }
    const { startedGame, initialState } = new GameEngine(KaivaiRuntime).startGame(
        game,
        '0123456789abcdef0123456789abcdef'
    )
    if (scoring) {
        initialState.machineState = MachineState.IslandBidding
        initialState.hutsScored = true
        initialState.islandsToScore = Object.keys(initialState.board.islands)
        initialState.chosenIsland = initialState.islandsToScore[0]
        initialState.bidders = ['p1', 'p2', 'p3']
        initialState.activePlayerIds = [...initialState.bidders]
        startedGame.activePlayerIds = [...initialState.activePlayerIds]
    }
    const app = createHarnessAppContext(storageDefinition)
    await app.gameService.saveGameLocally({ game: startedGame, state: initialState, actions: [] })
    return initialState.activePlayerIds[0]
}
