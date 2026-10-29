import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const Info1833NE: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1833ne',
    metadata: {
        name: '1833NE: Railroading in New England',
        bggId: 31619,
        hasScores: true,
        designer: 'Thomas Lehmann',
        year: '2026',
        description:
            'The Standard game for 3–5 players: an auction for six privates, 1846-style stock and operating rounds with issued and redeemed shares, N/M and N+s trains, ferries, and direct and interconnection bonuses that change with the phase.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    }
}
