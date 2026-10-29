import { ActionSource, assertExists, GameEngine, PlayerStatus, type Game } from '@tabletop/common'
import { HydratedPlaceCity, type PlaceCity } from '../actions/placeCity.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { IndonesiaInfo } from '../definition/info.js'
import { IndonesiaRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { IndonesiaGameState } from '../model/gameState.js'

export const engine = new GameEngine(IndonesiaRuntime)

export function createGame(count: number) {
    return IndonesiaRuntime.initializer.initializeGame(
        {
            id: 'indonesia-competition',
            typeId: IndonesiaInfo.id,
            ownerId: 'owner',
            seed: 101,
            config: {},
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

export function placeNewEraCities(game: Game, initialState: IndonesiaGameState) {
    let state = initialState
    while (state.machineState === MachineState.NewEra) {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'Expected an active player placing a city')
        const hydrated = IndonesiaRuntime.hydrator.hydrateState(state)
        const [areaId] = HydratedPlaceCity.validAreaIds(hydrated, playerId)
        assertExists(areaId, `Expected a city placement for ${playerId}`)
        const action: PlaceCity = {
            id: `city-${playerId}`,
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceCity,
            playerId,
            areaId
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}
