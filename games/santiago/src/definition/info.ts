import type { GameInfo } from '@tabletop/common'
import { SantiagoConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const SantiagoInfo: GameInfo = {
    id: 'santiago',
    metadata: {
        name: 'Santiago',
        designer: 'Claudia Hempel & Michael Hempel',
        description:
            'Santiago is a bidding and placement game in which players compete to irrigate their plantations. ' +
            'Each round, players bid openly for planting priority. The lowest bidder becomes the ditch master, who controls ' +
            'the new canal segment. Unirrigated plantations wither and dry out, so the canal network ' +
            'is crucial. Build the most prosperous irrigated plantations to win.',
        year: '2003',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new SantiagoConfigurator()
}
