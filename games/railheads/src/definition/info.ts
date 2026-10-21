import { GameVisibility, type GameInfo } from '@tabletop/common'
import { RailheadsConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const RailheadsInfo: GameInfo = {
    id: 'railheads',
    metadata: {
        name: 'Railheads',
        designer: 'Pontus Nilsson',
        description:
            'Invest in the railroads racing to reach the industries of Germany or the American Midwest. Choose actions from a shrinking round timer, auction shares and industry tokens, and lay track for the companies you back; the richest investor after four payouts wins.',
        year: '2026',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new RailheadsConfigurator()
}
