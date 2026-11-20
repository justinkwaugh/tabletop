import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { ConfiguratorMex } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const InfoMex: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '18mex',
    metadata: {
        name: '18MEX',
        bggId: 18485,
        hasScores: true,
        designer: 'Mark Derrick',
        year: '2006',
        description:
            'The railroads come to Mexico, for 3–5 players: run minor lines until the 3½ phase folds them into the national railway, then decide whether to merge a company of your own into the NdM when the first 5-train arrives. Mexico City fills with stations, and the richest player wins when the bank breaks.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new ConfiguratorMex()
}
