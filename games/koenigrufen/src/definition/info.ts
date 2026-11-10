import { GameVisibility, type GameInfo } from '@tabletop/common'
import { KoenigrufenConfigurator, PlayerCount } from './config.js'
import { KoenigrufenPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'

export const KoenigrufenInfo: GameInfo = {
    id: 'koenigrufen',
    metadata: {
        name: 'Königrufen',
        designer: 'Traditional',
        description:
            'The classic Austrian Tarock game for four. Bid for the right to name the contract, call a king to find a secret partner, and take at least 36 of the 70 card points with the 54-card Tarock pack.',
        year: '19th century',
        minPlayers: PlayerCount,
        maxPlayers: PlayerCount,
        defaultPlayerCount: PlayerCount,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new KoenigrufenConfigurator(),
    preferences: KoenigrufenPreferenceDefinition
}
