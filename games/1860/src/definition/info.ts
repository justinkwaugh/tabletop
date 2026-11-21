import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1860 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1860: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1860',
    metadata: {
        name: '1860: Railways on the Isle of Wight',
        bggId: 12750,
        hasScores: true,
        designer: 'Mike Hutton',
        year: '2004',
        description:
            'A knife fight in a phone booth for 2–4 players on the Isle of Wight: companies run out of trains and go insolvent, sink to nothing and go bankrupt, then float again for whoever dares. Halts pay subsidies, trains skip small stations, and when British Rail arrives the weakest lines close one round at a time.',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1860()
}
