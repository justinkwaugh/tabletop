import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { MatrxConfigurator } from './config.js'

export const MatrxInfo: GameInfo = {
    id: 'matrx',
    metadata: {
        name: 'MATRX GIPF',
        designer: 'Kris Burm',
        description:
            'MATRX GIPF plays GIPF with the potentials of the GIPF project: stacks that jump, slide, cover and earn extra moves. Line up four of your colour to recycle your pieces and capture your opponent’s, and protect your three GIPF pieces.',
        year: '2024',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new MatrxConfigurator()
}
