import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const Info1882: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1882',
    metadata: {
        name: '1882: Assiniboia',
        bggId: 282435,
        hasScores: true,
        designer: 'Marc Voyer',
        year: '2020',
        description:
            'Railways of the Canadian prairie for 2–6 players, short and sharp. Neutral stations keep cities open and let the Canadian National run, a rebellion tears up track in the north-west, and the Saskatchewan Central may become a railway of its own.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    }
}
