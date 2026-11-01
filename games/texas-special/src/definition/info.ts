import { GameVisibility, type GameInfo } from '@tabletop/common'
import { SarConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const SarInfo: GameInfo = {
    id: 'texas-special',
    metadata: {
        name: 'Texas Special',
        designer: 'Various',
        description:
            'Invest in the railroads racing across Texas and the neighboring states in the late 1800s. Bid for shares, build track for the railroads you control, develop the towns they serve and choose when dividends are paid. Link Katy or MoPac to SoPac or GH&H to found the Texas Special, and open the T&P by reaching Dallas. The richest investor after the final payoff wins. The rules are based on Age of Rail: South Africa, and the map is by James Geist.',
        year: '2026',
        minPlayers: 3,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new SarConfigurator()
}
