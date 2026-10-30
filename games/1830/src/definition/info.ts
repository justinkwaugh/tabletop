import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { EighteenThirtyConfigurator } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const EighteenThirtyInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1830',
    metadata: {
        name: '1830: Railways & Robber Barons',
        bggId: 421,
        hasScores: true,
        designer: 'Francis Tresham',
        year: '1986',
        description:
            'The 18xx that made the series. Play a robber baron in the north-eastern United States: float the great lines from the Pennsylvania to the Canadian Pacific, build track and run trains for the companies you lead. Invest in rivals’ companies but sell out before the next train rusts their fleet, or leave your own stripped company to a rival; the richest player when the bank breaks wins.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new EighteenThirtyConfigurator()
}
