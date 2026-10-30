import { GameVisibility, type GameInfo } from '@tabletop/common'
import { PromontoryPointConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

export const PromontoryPointInfo: GameInfo = {
    id: 'promontory-point',
    metadata: {
        name: 'Promontory Point',
        designer: 'Reiner Knizia',
        description:
            "Four transcontinental railroads race their track across the West toward Promontory. Players never own a railroad: they trade its shares, lay its track from a hidden hand, and profit or pay as each line reaches the towns.",
        year: '2026',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        hasScores: true,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new PromontoryPointConfigurator()
}
