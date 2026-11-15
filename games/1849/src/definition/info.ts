import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1849 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1849: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1849',
    metadata: {
        name: '1849: The Game of Sicilian Railways',
        bggId: 3097,
        hasScores: true,
        designer: 'Federico Vellani',
        year: '1998',
        description:
            'Railways of Sicily for 3–5 players, with narrow, standard and dual gauge track, hex trains, incremental capital and the Messina earthquake.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1849()
}
