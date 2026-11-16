import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { YinshConfigurator } from './config.js'
import { YinshPreferenceDefinition } from './preferences.js'

export const YinshInfo: GameInfo = {
    id: 'yinsh',
    metadata: {
        name: 'YINSH',
        bggId: 7854,
        designer: 'Kris Burm',
        series: 'gipf-project',
        description:
            'YINSH is a 2-player abstract game of the GIPF project. Move your rings, leave markers behind and flip the ones you jump; line up five of your color to take off a ring, and be the first to take off three.',
        year: '2003',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        hasScores: false,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new YinshConfigurator(),
    preferences: YinshPreferenceDefinition
}
