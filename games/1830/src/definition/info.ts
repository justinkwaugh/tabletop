import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { EighteenThirtyConfigurator } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const EighteenThirtyInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1830',
    metadata: {
        name: '1830: Railways & Robber Barons',
        designer: 'Francis Tresham',
        year: '1986',
        description:
            'Railway companies in the north-eastern United States, with a prototype interface.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new EighteenThirtyConfigurator()
}
