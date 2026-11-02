import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { PunctConfigurator } from './config.js'
import { PunctPreferenceDefinition } from './preferences.js'

export const PunctInfo: GameInfo = {
    id: 'punct',
    metadata: {
        name: 'PÜNCT',
        designer: 'Kris Burm',
        description:
            'PÜNCT is a game of linking: place and move three-dot pieces to connect two opposite sides of the board. Pieces jump onto other pieces and bridge gaps, and the piece on top always counts.',
        year: '2005',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new PunctConfigurator(),
    preferences: PunctPreferenceDefinition
}
