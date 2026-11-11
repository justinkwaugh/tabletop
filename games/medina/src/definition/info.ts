import { GameVisibility, type GameInfo } from '@tabletop/common'
import { MedinaConfigurator } from './gameConfig.js'
import { MedinaPreferenceDefinition } from './preferences.js'
import { GAME_VERSION } from './version.js'

export const MedinaInfo: GameInfo = {
    id: 'medina',
    metadata: {
        name: 'Medina',
        bggId: 167270,
        hasScores: true,
        designer: 'Stefan Dorra',
        description:
            'Build a desert city together, one wooden piece at a time. Palaces belong to nobody until someone lays a rooftop on one, so every building you add may end up making a rival rich. Stables, market streets, city walls and the well all add to what a claimed palace is worth.',
        year: '2014',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta
    },
    preferences: MedinaPreferenceDefinition,
    configurator: new MedinaConfigurator()
}
