
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const BusInfo: GameInfo = {
    id: 'bus',
    metadata: {
        name: 'Bus',
        designer: 'Unknown',
        description:
            'Bus is a tabletop game implemented using the Tabletop framework.',
        year: '2026',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: undefined
}