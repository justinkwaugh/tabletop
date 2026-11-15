import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { MaximumPlayers1822, MinimumPlayers1822 } from '../setup.js'
import { Configurator1822 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1822: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1822',
    metadata: {
        name: '1822: The Railways of Great Britain',
        bggId: 193867,
        hasScores: true,
        designer: 'Simon Cutforth',
        year: '2016',
        description:
            'Railways of Great Britain for 3–7 players: minor and major companies, concessions and private companies bought through bidding boxes, destinations, and L, Pullman and electric trains.',
        minPlayers: MinimumPlayers1822,
        maxPlayers: MaximumPlayers1822,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1822()
}
