import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesHydrator } from './hydrator.js'
import { EstatesGameInitializer } from './gameInitializer.js'
import { EstatesApiActions } from './apiActions.js'
import { EstatesStateHandlers } from './stateHandlers.js'
import { EstatesConfigurator } from './configurator.js'

export const Definition = <GameDefinition<EstatesGameState, HydratedEstatesGameState>>{
    id: 'estates',

    metadata: {
        name: 'The Estates',
        designer: 'Klaus Zoch',
        description:
            'The estates is a highly interactive auction game in which you act as investors vying to build profitable buildings.',
        year: '2018',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        beta: false
    },

    initializer: new EstatesGameInitializer(),
    configurator: new EstatesConfigurator(),
    hydrator: new EstatesHydrator(),

    stateHandlers: EstatesStateHandlers,
    apiActions: EstatesApiActions,
    playerColors: [],

    stateLogger: new DefaultStateLogger()
}
