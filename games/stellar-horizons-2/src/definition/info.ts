import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const StellarHorizonsInfo: GameInfo = {
    id: 'stellar-horizons-2',
    metadata: {
        name: 'Stellar Horizons II: Footfall among the Stars',
        designer: 'Andrew Rader',
        description:
            'In 2150 humanity reaches for its nearest stars. Build crew vehicles and robotic explorers, survey neighbouring systems for habitable worlds, research new technology, and be the first to plant ten settlements in a system that can support a population of 25.',
        year: '2025',
        minPlayers: 1,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    }
}
