import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { YConfigurator } from './config.js'
import { YPreferenceDefinition } from './preferences.js'

export const YInfo: GameInfo = {
    id: 'game-of-y',
    metadata: {
        name: 'The Game of Y',
        bggId: 5242,
        designer: 'Craige Schensted, Charles Titus',
        description:
            'The Game of Y is a 2-player connection game on a curved triangular board. Take turns placing a stone on any empty point; the first to join all three sides with one chain of their stones wins. Every game has a winner.',
        year: '1953',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        hasScores: false,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new YConfigurator(),
    preferences: YPreferenceDefinition
}
