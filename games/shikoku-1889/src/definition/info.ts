import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const Shikoku1889Info: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: 'shikoku-1889',
    metadata: {
        name: 'Shikoku 1889',
        designer: 'Yasutaka Ikeda',
        year: '',
        description: 'Railway companies on Shikoku, with a prototype interface.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: true
    }
}
