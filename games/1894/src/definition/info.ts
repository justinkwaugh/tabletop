import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { EighteenNinetyFourConfigurator } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const EighteenNinetyFourInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1894',
    metadata: {
        name: '1894',
        bggId: 410599,
        hasScores: true,
        designer: 'Jan Kłos',
        year: '2023',
        description:
            'In continental Europe the industrial revolution began in Belgium and the Nord, where coal, steel and textile towns wanted rails. Build an imagined network across north-eastern France and Belgium, from Paris to Brussels, Luxembourg and the ferry to London, in this 18xx for 3–4 players. Bid for private companies, float the French and Belgian majors, redeem and reissue their shares to fund trains, and place late companies wherever the map still has room; the richest player at the end wins.',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: false
    },
    configurator: new EighteenNinetyFourConfigurator()
}
