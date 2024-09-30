import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { EstatesHydrator } from './hydrator.js'
import { EstatesGameInitializer } from './gameInitializer.js'
import { EstatesApiActions } from './apiActions.js'
import { EstatesStateHandlers } from './stateHandlers.js'

export const EstatesDefinition = <GameDefinition>{
    id: 'estates',

    metadata: {
        name: 'The Estates',
        designer: 'Klaus Zoch',
        description: 'Bidding game',
        year: '2018',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        beta: true
    },

    initializer: new EstatesGameInitializer(),
    hydrator: new EstatesHydrator(),

    stateHandlers: EstatesStateHandlers,
    apiActions: EstatesApiActions,
    playerColors: [],

    configOptions: [],
    stateLogger: new DefaultStateLogger()
}
