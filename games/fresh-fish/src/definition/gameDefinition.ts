import { type GameDefinition } from '@tabletop/common'
import type { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishHydrator } from './hydrator.js'
import { FreshFishGameInitializer } from './gameInitializer.js'
import { FreshFishStateLogger } from '../util/stateLogger.js'
import { FreshFishApiActions } from './apiActions.js'
import { FreshFishStateHandlers } from './stateHandlers.js'
import { FreshFishColors } from './colors.js'
import { FreshFishConfigurator } from './configurator.js'

export const Definition = <GameDefinition<FreshFishGameState, HydratedFreshFishGameState>>{
    info: {
        id: 'freshfish',
        metadata: {
            name: 'Fresh Fish',
            designer: 'Friedemann Friese',
            description:
                "A spatial strategy game in which you try to build stalls to sell your goods as close as possible to the trucks that supply them.  Players vie to reserve spaces for their stalls, but rarely is a spot guaranteed.  Flea markets and other players' stalls will force the expropriation of the spaces, turning them into roadways to ensure everything stays connected.\n\u00a0\nOften a mean game.  Always fun.",
            year: '1997',
            minPlayers: 2,
            maxPlayers: 5,
            defaultPlayerCount: 4,
            version: '0.0.1',
            beta: false
        },
        configurator: new FreshFishConfigurator()
    },
    runtime: {
        initializer: new FreshFishGameInitializer(),
        hydrator: new FreshFishHydrator(),
        stateHandlers: FreshFishStateHandlers,
        apiActions: FreshFishApiActions,
        playerColors: FreshFishColors,
        stateLogger: new FreshFishStateLogger()
    }
}
