import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { GipfConfigurator } from './config.js'

export const GipfInfo: GameInfo = {
    id: 'gipf',
    metadata: {
        name: 'GIPF',
        designer: 'Kris Burm',
        description:
            'GIPF is the 2-player abstract game that started the GIPF project. Push pieces onto the board from its edge, line up four of your colour to recycle them and capture your opponent’s, and protect your GIPF-pieces.',
        year: '1997',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new GipfConfigurator()
}
