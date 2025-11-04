import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { SolHydrator } from './hydrator.js'
import { SolGameInitializer } from './gameInitializer.js'
import { SolApiActions } from './apiActions.js'
import { SolStateHandlers } from './stateHandlers.js'
import { SolColors } from './colors.js'
import { SolGameConfigOptions } from './gameConfig.js'

export const Definition = <GameDefinition>{
    id: 'sol',

    metadata: {
        name: 'Sol',
        designer: '',
        description: 'A Game',
        year: '2005',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        beta: true
    },

    initializer: new SolGameInitializer(),
    hydrator: new SolHydrator(),

    stateHandlers: SolStateHandlers,
    apiActions: SolApiActions,
    playerColors: SolColors,

    configOptions: SolGameConfigOptions,
    stateLogger: new DefaultStateLogger()
}
