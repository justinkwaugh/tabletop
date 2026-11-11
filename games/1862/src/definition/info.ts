import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1862 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1862: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1862',
    metadata: {
        name: '1862: Railway Mania in the Eastern Counties',
        bggId: 66837,
        hasScores: true,
        designer: 'Mike Hutton',
        year: '2013',
        description:
            'Railway mania in East Anglia for 2–8 players: petition Parliament for charters, run Freight, Local and Express trains under permits, and merge companies two shares for one.',
        minPlayers: 2,
        maxPlayers: 8,
        defaultPlayerCount: 5,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1862()
}
