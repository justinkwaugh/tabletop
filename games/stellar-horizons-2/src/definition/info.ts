import { GameVisibility, type GameInfo } from '@tabletop/common'
import { StellarHorizonsConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

export const StellarHorizonsInfo: GameInfo = {
    id: 'stellar-horizons-2',
    metadata: {
        name: 'Stellar Horizons II: Galactic Frontier',
        designer: 'Andrew Rader',
        description:
            'Humanity reaches for its nearest stars. Build crew vehicles and robotic explorers, survey neighbouring systems for habitable worlds and research new technology. Scenarios: Footfall among the Stars, a race to plant ten settlements in a system that can support 25, and These are the Voyages, a race across six sectors to resolve four anomalies.',
        year: '2025',
        minPlayers: 1,
        maxPlayers: 4,
        defaultPlayerCount: 3,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new StellarHorizonsConfigurator()
}
