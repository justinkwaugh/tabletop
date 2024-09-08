import { type GameDefinition } from '@tabletop/common'
import { FreshFishHydrator } from './hydrator.js'
import { FreshFishGameInitializer } from './gameInitializer.js'
import { FreshFishStateLogger } from '../util/stateLogger.js'
import { FreshFishApiActions } from './apiActions.js'
import { FreshFishStateHandlers } from './stateHandlers.js'
import { FreshFishPlayerColors } from './colors.js'

export const FreshFishDefinition = <GameDefinition>{
    id: 'freshfish',

    metadata: {
        name: 'Fresh Fish',
        designer: 'Friedmann Friese',
        year: '1997',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4
    },

    initializer: new FreshFishGameInitializer(),
    hydrator: new FreshFishHydrator(),

    stateHandlers: FreshFishStateHandlers,
    apiActions: FreshFishApiActions,
    playerColors: FreshFishPlayerColors,

    configOptions: [],
    stateLogger: new FreshFishStateLogger()
}
