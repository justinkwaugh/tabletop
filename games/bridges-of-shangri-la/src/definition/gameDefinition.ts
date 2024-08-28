import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { BridgesHydrator } from './hydrator.js'
import { BridgesGameInitializer } from './gameInitializer.js'
import { BridgesApiActions } from './apiActions.js'
import { BridgesStateHandlers } from './stateHandlers.js'
import { BridgesPlayerColors } from './colors.js'

export const BridgesDefinition = <GameDefinition>{
    id: 'bridges',

    metadata: {
        name: 'Bridges of Shangri-La',
        designer: 'Leo Colovini',
        year: '2003',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 3
    },

    initializer: new BridgesGameInitializer(),
    hydrator: new BridgesHydrator(),

    stateHandlers: BridgesStateHandlers,
    apiActions: BridgesApiActions,
    playerColors: BridgesPlayerColors,

    config: {},
    stateLogger: new DefaultStateLogger()
}
