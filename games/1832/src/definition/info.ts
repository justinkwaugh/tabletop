import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const EighteenThirtyTwoInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1832',
    metadata: {
        name: '1832: The South',
        designer: 'W. R. Dixon',
        year: '2006',
        description:
            'Railways of the American South for 2–7 players, with 1850-style share price protection, redemption and reissue, and the mergers that form Systems.',
        minPlayers: 2,
        maxPlayers: 7,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    }
}
