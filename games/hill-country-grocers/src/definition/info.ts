import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

// Implemented with official permission from the designer, Jake Stanley, granted October 6, 2026.
export const HcgInfo: GameInfo = {
    id: 'hill-country-grocers',
    metadata: {
        name: 'Hill Country Grocers',
        designer: 'Jake Stanley',
        description:
            'Invest in grocery chains expanding across the Texas Hill Country. Bid for shares, build the distribution networks of the chains you own and develop the cities they serve; the richest investor when the shelves run bare wins.',
        year: '2025',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    }
}
