import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const EighteenSeventeenInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1817',
    metadata: {
        name: '1817',
        designer: 'Craig Bartell, Tim Flowers',
        year: '2010',
        description:
            'Railway companies on the Wall Street of the north-eastern United States, with a prototype interface.',
        minPlayers: 3,
        maxPlayers: 12,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    }
}
