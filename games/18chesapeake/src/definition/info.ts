import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { ConfiguratorChesapeake } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const InfoChesapeake: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '18chesapeake',
    metadata: {
        name: '18Chesapeake',
        bggId: 253608,
        hasScores: true,
        designer: 'Scott Petersen',
        year: '2018',
        description:
            'The birth of American railroads around Chesapeake Bay, for 2–6 players: a straightforward 18xx with eight companies, where the bank exports a train after every set of operating rounds, so the old trains rust whether or not anyone buys.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new ConfiguratorChesapeake()
}
