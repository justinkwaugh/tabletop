
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { LowenherzConfigurator } from './configurator.js'

export const LowenherzInfo: GameInfo = {
    id: 'lowenherz',
    metadata: {
        name: 'Löwenherz',
        designer: 'Klaus Teuber',
        description:
            'Löwenherz is a land development and territory-control game. Each round, an action card ' +
            'offers three ways to grow your power — claiming ducats, building boundary walls, or placing ' +
            'knights to expand and defend your regions — and every prince picks one by laying a decision ' +
            'card. Ties are settled by negotiation or a duel. Politics cards add Alliances, Renegades, and ' +
            'Treasure to the mix. Whoever has amassed the most power when the King dies succeeds him.',
        year: '1997',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new LowenherzConfigurator()
}