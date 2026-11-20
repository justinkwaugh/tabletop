import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { OathConfigurator } from './configurator.js'

export const OathInfo: GameInfo = {
    id: 'oath',
    metadata: {
        name: 'Oath',
        bggId: 291572,
        hasScores: false,
        designer: 'Cole Wehrle',
        publisher: {
            name: 'Buried Giant Studios',
            url: 'https://buriedgiant.shop/products/oath',
            sellsGame: true
        },
        description:
            'A game of empire and exile. The Chancellor defends an Oath while Exiles gather followers, campaign across the realm and chase Visions of a different future.',
        year: '2021',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new OathConfigurator()
}
