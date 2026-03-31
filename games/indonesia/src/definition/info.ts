import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const IndonesiaInfo: GameInfo = {
    id: 'indonesia',
    metadata: {
        name: 'Indonesia',
        designer: 'Jeroen Doumen and Joris Wiersinga',
        description:
            'Indonesia is a game in which three to five players build up an economy, trying to acquire the most money. Players acquire production companies and shipping companies and compete to deliver to and grow cities.',
        year: '2005',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: undefined
}
