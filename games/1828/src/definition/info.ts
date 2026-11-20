import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1828 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1828: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1828',
    metadata: {
        name: '1828',
        bggId: 272538,
        hasScores: true,
        designer: 'J C Lawrence',
        year: '2018',
        description:
            'Railroads of the northeastern United States and Canada, for 3–5 players: sixteen companies, no certificate limit, a deep stock market with a gray floor, unsaleable $250 privates that each bring a directorship, and mergers that pair two companies into a system with two charters of trains.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1828()
}
