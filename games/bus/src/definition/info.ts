import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const BusInfo: GameInfo = {
    id: 'bus',
    metadata: {
        name: 'Bus',
        designer: 'Jeroen Doumen and Joris Wiersinga',
        description:
            'Bus is a highly interactive 3–5 player, 120-minute, route-building, and worker placement game from Splotter where players develop public transport in a city. Players build routes, expand bus capacity, place buildings, and move passengers to homes, offices, or pubs to score points.',
        year: '1999',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: undefined
}
