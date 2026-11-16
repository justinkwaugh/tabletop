import { EighteenXXPreferenceDefinition, EighteenXXSeries } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { Configurator1861 } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const Info1861: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1861',
    metadata: {
        name: '1861: The Railways of the Russian Empire',
        bggId: 23817,
        hasScores: true,
        designer: 'Ian D. Wilson',
        year: '2006',
        description:
            'Railways of Tsarist Russia for 2–6 players: minor companies auctioned and merged into public companies, loans, and a Russian State Railway that nationalises the failures.',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        series: EighteenXXSeries,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new Configurator1861()
}
