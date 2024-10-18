import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { EstatesHydrator } from './hydrator.js'
import { EstatesGameInitializer } from './gameInitializer.js'
import { EstatesApiActions } from './apiActions.js'
import { EstatesStateHandlers } from './stateHandlers.js'
import { EstatesGameConfigOptions } from './gameConfig.js'

export const EstatesDefinition = <GameDefinition>{
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
    hydrator: new EstatesHydrator(),

    stateHandlers: EstatesStateHandlers,
    apiActions: EstatesApiActions,
    playerColors: [],

    configOptions: EstatesGameConfigOptions,
    stateLogger: new DefaultStateLogger()
}
