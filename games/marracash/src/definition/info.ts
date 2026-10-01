import type { GameInfo } from '@tabletop/common'
import { MarracashConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const MarracashInfo: GameInfo = {
    id: 'marracash',
    metadata: {
        name: 'MarraCash',
        designer: 'Stefan Dorra',
        description:
            'Auction market stalls in old Marrakesh and steer crowds of visitors into your shops, earning a cut when you send customers to your rivals.',
        year: '1996',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new MarracashConfigurator()
}
