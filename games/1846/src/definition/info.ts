import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
export const EighteenFortySixInfo: GameInfo = {
    id: '1846',
    metadata: {
        name: '1846: The Race to the Midwest',
        designer: 'Thomas Lehmann',
        year: '2005',
        description:
            'GMT second-printing rules for 2–5 players: recurring stock and operating rounds, phase-I–IV construction and trains, routes and earnings, East–West scoring, corporate private purchases, independent absorption and private revenue/construction/station powers. Includes train trading, emergency funding and personal share sales, bankruptcy, receivership, presidency recovery and the last-survivor ending. Includes phase closures, phased-out trains, compulsory discards, bank resale, unlimited final trains and gray construction. Includes bank-break and all-companies-closed endings, final scoring and tied winners. Includes the two-player public opening, preliminary operations, adjusted stock limits, blocking stations, finite final trains and the last-train ending.',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: true
    }
}
