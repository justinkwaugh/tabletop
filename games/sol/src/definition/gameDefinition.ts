import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { HydratedSolGameState, SolGameState } from '../model/gameState.js'
import { SolHydrator } from './hydrator.js'
import { SolGameInitializer } from './gameInitializer.js'
import { SolApiActions } from './apiActions.js'
import { SolStateHandlers } from './stateHandlers.js'
import { SolColors } from './colors.js'
import { SolConfigurator } from './configurator.js'

export const Definition = <GameDefinition<SolGameState, HydratedSolGameState>>{
    info: {
        id: 'sol',
        metadata: {
            name: 'Sol: Last Days of a Star',
            designer: 'Ryan and Sean Spangler, Jodi Sweetman',
            description:
                'Sol: Last Days of a Star is a board game for one to five players where each player represents a different planetary effort to transmit as much energy from the Sun back to their Ark so they can try to escape the solar system before the Sun explodes!',
            year: '2017',
            minPlayers: 2,
            maxPlayers: 5,
            defaultPlayerCount: 4,
            version: '1.0.0',
            beta: false
        },
        configurator: new SolConfigurator()
    },
    runtime: {
        initializer: new SolGameInitializer(),
        hydrator: new SolHydrator(),
        stateHandlers: SolStateHandlers,
        apiActions: SolApiActions,
        playerColors: SolColors,
        stateLogger: new DefaultStateLogger()
    }
}
