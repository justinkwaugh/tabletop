import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1856 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1856: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1856',
    metadata: {
        name: '1856: Railroading in Upper Canada',
        bggId: 423,
        hasScores: true,
        designer: 'Bill Dixon',
        year: '1995',
        description:
            'Railways of Upper Canada for 3–6 players: capital held in escrow until a company reaches its destination, generous government loans, and a Canadian Government Railways that absorbs every company unable to repay them.',
        minPlayers: 3,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1856()
}
