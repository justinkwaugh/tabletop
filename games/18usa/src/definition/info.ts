import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { EighteenUSAConfigurator } from './gameConfig.js'

export const EighteenUSAInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '18usa',
    metadata: {
        name: '18USA',
        bggId: 219717,
        hasScores: true,
        designer: 'Edward Reece, Mark Hendrickson, Shawn Fox',
        year: '2017',
        description:
            'An 1817 derivative across the whole United States, with random privates, metropolises, subsidy cities and red-area values in every game.',
        minPlayers: 2,
        maxPlayers: 7,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new EighteenUSAConfigurator()
}
