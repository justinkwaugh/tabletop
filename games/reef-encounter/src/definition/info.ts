import { GameVisibility, type GameInfo } from '@tabletop/common'
import { ReefEncounterConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

// Implemented with official permission from the designer, Richard Breese.
export const ReefEncounterInfo: GameInfo = {
    id: 'reef-encounter',
    metadata: {
        name: 'Reef Encounter',
        designer: 'Richard Breese',
        description:
            'Grow corals across the reef, guard them with your shrimps and feed whole corals to your parrotfish. Shift which corals overpower which, so that what your parrotfish has eaten is worth the most when the reef runs out.',
        year: '2004',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new ReefEncounterConfigurator()
}
