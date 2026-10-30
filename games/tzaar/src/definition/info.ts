import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { TzaarConfigurator } from './config.js'
import { TzaarPreferenceDefinition } from './preferences.js'

export const TzaarInfo: GameInfo = {
    id: 'tzaar',
    metadata: {
        name: 'TZAAR',
        designer: 'Kris Burm',
        description:
            "TZAAR is a 2-player abstract game of the GIPF project. Each turn, capture an enemy piece, then capture again, strengthen one of your stacks or pass. Win by taking the last of your opponent's Tzaars, Tzarras or Totts, or by leaving them nothing to capture.",
        year: '2007',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new TzaarConfigurator(),
    preferences: TzaarPreferenceDefinition
}
