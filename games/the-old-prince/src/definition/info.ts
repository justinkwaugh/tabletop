import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const TheOldPrinceInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: 'the-old-prince',
    metadata: {
        name: 'The Old Prince 1871',
        designer: 'Lucas Boyd',
        year: '',
        description: 'Railway companies on Prince Edward Island, with a prototype interface.',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    }
}
