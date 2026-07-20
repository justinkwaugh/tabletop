
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const LowenherzInfo: GameInfo = {
    id: 'lowenherz',
    metadata: {
        name: 'Löwenherz',
        designer: 'Klaus Teuber',
        description:
            'Löwenherz is a land development and auction game. This implementation is currently a skeleton scaffold — the real rules have not been implemented yet.',
        year: '1997',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    },
    configurator: undefined
}