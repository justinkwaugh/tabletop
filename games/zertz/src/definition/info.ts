import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { ZertzConfigurator } from './config.js'
import { ZertzPreferenceDefinition } from './preferences.js'

export const ZertzInfo: GameInfo = {
    id: 'zertz',
    metadata: {
        name: 'ZÈRTZ',
        designer: 'Kris Burm',
        description:
            'ZÈRTZ is a 2-player abstract game from the GIPF project. Players share a pool of marbles, placing them on a shrinking board of rings and forcing captures, racing to collect a winning set of marbles.',
        year: '1999',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new ZertzConfigurator(),
    preferences: ZertzPreferenceDefinition
}
