import type { GameInfo } from '@tabletop/common'
import { NapoleonsTriumphConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

export const NapoleonsTriumphInfo: GameInfo = {
    id: 'napoleons-triumph',
    metadata: {
        name: "Napoleon's Triumph",
        designer: 'Rachel Simmons',
        description:
            'Austerlitz, 2 December 1805. Two armies of hidden wooden blocks manoeuvre by corps across the Moravian hills. There are no dice: an attack is a threat, a bluff and a sequence of commitments, and one lost fight can break a corps. Break the enemy army’s morale, or hold the ground that matters when the short winter day ends.',
        year: '2007',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        version: GAME_VERSION,
        beta: true
    },
    configurator: new NapoleonsTriumphConfigurator()
}
