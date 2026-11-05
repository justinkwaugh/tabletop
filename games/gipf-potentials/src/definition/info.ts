import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { GipfPotentialsConfigurator } from './config.js'
import { GipfPotentialsPreferenceDefinition } from './preferences.js'

export const GipfPotentialsInfo: GameInfo = {
    id: 'gipf-potentials',
    metadata: {
        name: 'GIPF with Potentials',
        designer: 'Kris Burm',
        description:
            'GIPF with the potentials of the GIPF project loaded onto your pieces: extra moves, jumps, slides and covers. Line up four of your colour to recycle your pieces and capture your opponent’s, and keep a GIPF-piece in play.',
        year: '1997',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new GipfPotentialsConfigurator(),
    preferences: GipfPotentialsPreferenceDefinition
}
