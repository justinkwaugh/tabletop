import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const TheOldPrinceInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: 'the-old-prince',
    metadata: {
        name: 'The Old Prince 1871',
        designer: 'Lucas Boyd',
        year: '',
        description:
            'Once called the most crooked railway in the world, both physically and financially, the Prince Edward Island Railway nearly bankrupted the island within a year. Build it again in this 18xx for 3–4 players, splitting companies into branch lines as the island fills with track.',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: false
    }
}
