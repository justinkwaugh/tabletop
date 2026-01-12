import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { ContainerGameState, HydratedContainerGameState } from '../model/gameState.js'
import { ContainerHydrator } from './hydrator.js'
import { ContainerGameInitializer } from './initializer.js'
import { ContainerApiActions } from './apiActions.js'
import { ContainerStateHandlers } from './stateHandlers.js'
import { ContainerPlayerColors } from './colors.js'
import { ContainerConfigurator } from './configurator.js'

export const Definition: GameDefinition<ContainerGameState, HydratedContainerGameState> =
    <GameDefinition<ContainerGameState, HydratedContainerGameState>>{
    id: 'container',

    metadata: {
        name: 'Container',
        designer: 'Franz-Benno Delonge',
        description:
            'A market-driven logistics game about building factories, setting prices, shipping goods, and running auctions to stock your island.',
        year: '2007',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        beta: true
    },

    initializer: new ContainerGameInitializer(),
    configurator: new ContainerConfigurator(),
    hydrator: new ContainerHydrator(),

    stateHandlers: ContainerStateHandlers,
    apiActions: ContainerApiActions,
    playerColors: ContainerPlayerColors,

    stateLogger: new DefaultStateLogger()
}
