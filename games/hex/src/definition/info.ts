import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { HexConfigurator } from './config.js'
import { HexPreferenceDefinition } from './preferences.js'

export const HexInfo: GameInfo = {
    id: 'hex',
    metadata: {
        name: 'Hex',
        bggId: 4112,
        designer: 'Piet Hein, John Nash',
        description:
            'Hex is a 2-player connection game on a rhombus of hexagons. Red joins top and bottom, Blue joins left and right: take turns filling any empty cell, and the first to join their two edges with one chain wins. Every game has a winner.',
        year: '1942',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        hasScores: false,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new HexConfigurator(),
    preferences: HexPreferenceDefinition
}
