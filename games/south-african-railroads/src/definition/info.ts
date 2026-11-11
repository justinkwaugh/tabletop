import { GameVisibility, type GameInfo } from '@tabletop/common'
import { SarConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const SarInfo: GameInfo = {
    id: 'south-african-railroads',
    metadata: {
        name: 'South African Railroads',
        designer: 'John Bohrer',
        description:
            'Invest in the railroads racing across southern Africa, the eastern United States or Texas and its neighbours. Bid for shares, build track for the railroads you control, develop the towns they serve and choose when dividends are paid; the richest investor after the final payoff wins. Play South African Railroads, Pennsylvania Railroad or Veld Railroads by John Bohrer, published by Winsome Games, or the Texas Special map by James Geist.',
        year: '2011',
        minPlayers: 3,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new SarConfigurator()
}
