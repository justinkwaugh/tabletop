import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const KoggeInfo: GameInfo = {
    id: 'kogge',
    metadata: {
        name: 'Kogge',
        designer: 'Andreas Steding',
        description:
            'Hanseatic merchants sail their cogs around the Baltic, where the routes between the nine trading cities shift from turn to turn. Bid route markers for the turn order, trade goods at two for one, found trading offices, deal with the wandering guild master, and raid when it pays. Five development points win at once; otherwise the richest merchant wins when the guild master completes his second lap.',
        year: '2003',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true
    }
}
