import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1850 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1850: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1850',
    metadata: {
        name: '1850: The MidWest',
        bggId: 21182,
        hasScores: true,
        designer: 'Bill Dixon',
        year: '2005',
        description:
            'Railways of the American Midwest for 2–6 players, with share price protection, redemption and reissue, edge tokens and the Mesabi Range.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1850()
}
