import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { BridgesGameState, HydratedBridgesGameState } from '../model/gameState.js'
import { BridgesHydrator } from './hydrator.js'
import { BridgesGameInitializer } from './gameInitializer.js'
import { BridgesApiActions } from './apiActions.js'
import { BridgesStateHandlers } from './stateHandlers.js'
import { BridgesColors } from './colors.js'

export const Definition = <GameDefinition<BridgesGameState, HydratedBridgesGameState>>{
    id: 'bridges',

    metadata: {
        name: 'The Bridges of Shangri-La',
        designer: 'Leo Colovini',
        description:
            'The Bridges of Shangri-La is a simple yet highly interactive strategy game in which players send their intellectual and spiritual masters and students to the villages high in the mountains. As the game progresses, the students make journeys from village to village spreading their influence, but every journey is a one way trip.  The connecting bridges collapse upon use, leaving the villages ultimately isolated.',
        year: '2003',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        beta: false
    },

    initializer: new BridgesGameInitializer(),
    hydrator: new BridgesHydrator(),

    stateHandlers: BridgesStateHandlers,
    apiActions: BridgesApiActions,
    playerColors: BridgesColors,

    stateLogger: new DefaultStateLogger()
}
