import type { GameInfo } from '@tabletop/common'
import { PowerGridConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

export const PowerGridInfo: GameInfo = {
    id: 'power-grid',
    metadata: {
        name: 'Power Grid',
        designer: 'Friedemann Friese',
        description:
            'Run a power company: win power plants at auction, buy coal, oil, garbage and uranium as prices rise and fall, and build a network of cities. Whoever can supply the most cities when the grid is complete wins.',
        year: '2004',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new PowerGridConfigurator()
}
