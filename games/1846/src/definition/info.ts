import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
export const EighteenFortySixInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1846',
    metadata: {
        name: '1846: The Race for the Midwest',
        bggId: 17405,
        hasScores: true,
        designer: 'Thomas Lehmann',
        year: '2005',
        description:
            'Five eastern railroads crossed the Appalachians in search of midwestern grain, and the land-grant Illinois Central is forming to meet them. Draft private companies, then launch and steer the great lines toward Chicago and St. Louis, linking East and West in this 18xx for 2–5 players. Issue shares to fund your railroads and buy trains from your rivals, but a company with no train must get one, and if its treasury can’t pay, its president must.',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: false
    }
}
