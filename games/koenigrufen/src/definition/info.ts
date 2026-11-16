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
            'The classic Austrian Tarock game for four. Bid for the right to name a contract, call a king to find a secret partner, and meet your goals to win points. Best played live: every trick needs a card from each player, so asynchronous games move quite slowly.',
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
