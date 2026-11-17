import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1880 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1880: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1880',
    metadata: {
        name: '1880: China',
        bggId: 69601,
        hasScores: true,
        designer: 'Helmut Ohley, Leonhard Orgler',
        year: '2010',
        description:
            'Railways across China for 3–7 players. Operating rounds never stop: share rounds break in whenever a kind of train runs out. Building permits ration track by phase, foreign investors build towards their companies, and the Communist Takeover freezes the stock market.',
        minPlayers: 3,
        maxPlayers: 7,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1880()
}
