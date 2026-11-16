import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { DvonnConfigurator } from './config.js'
import { DvonnPreferenceDefinition } from './preferences.js'

export const DvonnInfo: GameInfo = {
    id: 'dvonn',
    metadata: {
        name: 'DVONN',
        bggId: 2346,
        designer: 'Kris Burm',
        series: 'gipf-project',
        description:
            'DVONN is a 2-player abstract game of the GIPF project. Fill the board, then stack pieces on top of each other while staying linked to the three red DVONN pieces; whatever gets cut off leaves the board. Control the most pieces when no moves remain.',
        year: '2001',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        hasScores: false,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new DvonnConfigurator(),
    preferences: DvonnPreferenceDefinition
}
