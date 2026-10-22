import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { LyngkConfigurator } from './config.js'
import { LyngkPreferenceDefinition } from './preferences.js'

export const LyngkInfo: GameInfo = {
    id: 'lyngk',
    metadata: {
        name: 'LYNGK',
        designer: 'Kris Burm',
        description:
            'LYNGK is the 2-player epilogue of the GIPF project. Claim two of five colors, move stacks across a shared network of pieces, and build stacks of five different colors.',
        year: '2017',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new LyngkConfigurator(),
    preferences: LyngkPreferenceDefinition
}
