import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1870 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1870: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1870',
    metadata: {
        name: '1870: Railroading Across the Trans-Mississippi',
        bggId: 424,
        hasScores: true,
        designer: 'Bill Dixon',
        year: '1992',
        description:
            'Railways of the Trans-Mississippi for 2–7 players, with share price protection, redemption and reissue, and connection runs to each company’s destination.',
        minPlayers: 2,
        maxPlayers: 7,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1870()
}
