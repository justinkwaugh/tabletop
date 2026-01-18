import type { GameInfo } from '@tabletop/common'
import { EstatesConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const EstatesInfo: GameInfo = {
    id: 'estates',
    metadata: {
        name: 'The Estates',
        designer: 'Klaus Zoch',
        description:
            'The estates is a highly interactive auction game in which you act as investors vying to build profitable buildings.',
        year: '2018',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new EstatesConfigurator()
}
