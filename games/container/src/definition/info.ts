import type { GameInfo } from '@tabletop/common'
import { ContainerConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const ContainerInfo: GameInfo = {
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
        version: GAME_VERSION,
        beta: true
    },
    configurator: new ContainerConfigurator()
}
