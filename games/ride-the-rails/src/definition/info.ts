import type { GameInfo } from '@tabletop/common'
import { RideTheRailsConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

// R-1.2: three to five players, as printed. R-8: the map is chosen at creation.
export const RideTheRailsInfo: GameInfo = {
    id: 'ride-the-rails',
    metadata: {
        name: 'Ride the Rails',
        designer: 'John Bohrer',
        description:
            'Take shares in American railroads, build their track across the map, then carry passengers along the network. Every railroad a journey rides pays its shareholders, and after six rounds the richest player wins.',
        year: '2020',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new RideTheRailsConfigurator()
}
