import { GameVisibility, type GameInfo } from '@tabletop/common'
import { MagnaGreciaConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

export const MagnaGreciaInfo: GameInfo = {
    id: 'magna-grecia',
    metadata: {
        name: 'Magna Grecia',
        designer: 'Leo Colovini and Michael Schacht',
        description:
            'Greek settlers develop southern Italy: found and grow cities, weave a network of roads between villages, build markets, and court the favour of the oracles. Each round an action card sets the turn order and how many roads, cities and fresh tiles are on offer.',
        year: '2002',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new MagnaGreciaConfigurator()
}
