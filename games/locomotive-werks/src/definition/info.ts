import { GameVisibility, type GameInfo } from '@tabletop/common'
import { LwConfigurator } from './configurator.js'
import { LwPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'

export const LwInfo: GameInfo = {
    id: 'locomotive-werks',
    metadata: {
        name: 'Locomotive Werks',
        designer: 'Dieter Danziger',
        description:
            'Develop ever more advanced locomotives, build the werks to produce them and sell them while the market wants them. Dice show the orders for each locomotive; old technology fades as new generations arrive. The first to $300 after taxes ends the game, and the richest engineer wins.',
        year: '2002',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta,
        bggId: 3828,
        hasScores: true
    },
    configurator: new LwConfigurator(),
    preferences: LwPreferenceDefinition
}
