import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const Shikoku1889Info: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: 'shikoku-1889',
    metadata: {
        name: 'Shikoku 1889',
        bggId: 23540,
        hasScores: true,
        designer: 'Yasutaka Ikeda',
        year: '2004',
        description:
            'Shikoku’s first railways opened in the 1880s, short lines linking ports, castle towns and the Kotohira shrine. Float the Iyo, Sanuki, Tosa and Awa companies and push their track through the island’s mountains in this compact 18xx for 2–6 players. Private ferries and mines give an early edge, but on a small map every station blocks a rival route and every new train rusts an old fleet; the richest player when the bank breaks wins.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: false
    }
}
