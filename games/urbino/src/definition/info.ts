import type { GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { UrbinoConfigurator } from './configurator.js'

export const UrbinoInfo: GameInfo = {
    id: 'urbino',
    metadata: {
        name: 'Urbino',
        designer: 'Dieter Stein',
        description:
            'Urbino is a 2-player abstract strategy game where players develop the city of Urbino by constructing districts. Use two shared architect figures to control where buildings may be placed, then contest districts with houses, palaces, and towers.',
        year: '2011',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new UrbinoConfigurator()
}
