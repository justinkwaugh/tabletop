import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { KaivaiHydrator } from './hydrator.js'
import { KaivaiGameInitializer } from './gameInitializer.js'
import { KaivaiApiActions } from './apiActions.js'
import { KaivaiStateHandlers } from './stateHandlers.js'
import { KaivaiPlayerColors } from './colors.js'

export const KaivaiDefinition = <GameDefinition>{
    id: 'kaivai',

    metadata: {
        name: 'Kaivai',
        designer: 'Leo Colovini',
        year: '2003',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 4
    },

    initializer: new KaivaiGameInitializer(),
    hydrator: new KaivaiHydrator(),

    stateHandlers: KaivaiStateHandlers,
    apiActions: KaivaiApiActions,
    playerColors: KaivaiPlayerColors,

    config: {},
    stateLogger: new DefaultStateLogger()
}
