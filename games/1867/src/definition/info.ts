import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1867 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1867: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1867',
    metadata: {
        name: '1867: The Railways of Canada',
        bggId: 184524,
        hasScores: true,
        designer: 'Ian D. Wilson',
        year: '2017',
        description:
            'Railways of Canada for 2–6 players: minor companies auctioned into any open city and merged into majors, loans, and a Canadian National that nationalises the failures and exports the trains.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1867()
}
