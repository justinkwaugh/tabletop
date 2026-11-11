import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const OstbahnInfo: GameInfo = {
    id: 'preussische-ostbahn',
    metadata: {
        name: 'Preußische Ostbahn',
        bggId: 35285,
        hasScores: true,
        designer: 'John Bohrer',
        description:
            'Invest in eight German railroads of the 1840s and build their track across the German states. Railroads pay dividends whenever two of them meet in a city for the first time, and the less you earn, the more often you get to act.',
        year: '2008',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta
    }
}
