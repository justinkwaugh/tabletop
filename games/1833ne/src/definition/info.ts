import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { Configurator1833NE } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1833NE: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1833ne',
    metadata: {
        name: '1833NE: Railroading in New England',
        bggId: 31619,
        hasScores: true,
        designer: 'Thomas Lehmann',
        publisher: {
            name: 'GMT Games',
            url: 'https://www.gmtgames.com/p-864-1833ne.aspx',
            sellsGame: true
        },
        year: '2026',
        description:
            'When the Erie Canal drew Midwestern trade to New York, Boston’s merchants answered with railroads, first to join it and then to outflank it. Bid for six private companies, then float the lines that linked Boston to Worcester, Providence, Vermont and Montreal’s ice-free port at Portland in this 18xx for 3–5 players. Issue shares to buy trains, run ferries across Long Island Sound and chase route bonuses that change with each phase; the Takeover game adds five railroads that can start in any open city and take over their rivals. The richest player when the bank breaks wins.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: false
    },
    configurator: new Configurator1833NE()
}
