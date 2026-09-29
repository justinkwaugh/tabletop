import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { OathConfigurator } from './configurator.js'

export const OathInfo: GameInfo = {
    id: 'oath',
    metadata: {
        name: 'Oath',
        designer: 'Cole Wehrle',
        description:
            'A game of empire and exile. The Chancellor defends an Oath while Exiles gather followers, campaign across the realm and chase Visions of a different future.',
        year: '2021',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new OathConfigurator()
}
