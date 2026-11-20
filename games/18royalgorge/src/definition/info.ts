import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { ConfiguratorRoyalGorge } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const InfoRoyalGorge: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '18royalgorge',
    metadata: {
        name: '18RoyalGorge',
        bggId: 381671,
        hasScores: true,
        designer: 'Kayla Ross & Denman Scofield',
        year: '2025',
        description:
            'The rails of Fremont County and the Royal Gorge War, for 2–4 players: every tile buys steel from CF&I, railroads ship gold for Victor Gold Company, and the Treaty of Boston leaves Rio Grande and Santa Fe in debt.',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new ConfiguratorRoyalGorge()
}
