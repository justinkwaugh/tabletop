import type { GameInfo } from '@tabletop/common'
import { FreshFishConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const FreshFishInfo: GameInfo = {
    id: 'freshfish',
    metadata: {
        name: 'Fresh Fish',
        designer: 'Friedemann Friese',
        description:
            "A spatial strategy game in which you try to build stalls to sell your goods as close as possible to the trucks that supply them.  Players vie to reserve spaces for their stalls, but rarely is a spot guaranteed.  Flea markets and other players' stalls will force the expropriation of the spaces, turning them into roadways to ensure everything stays connected.\n\u00a0\nOften a mean game.  Always fun.",
        year: '1997',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new FreshFishConfigurator()
}
