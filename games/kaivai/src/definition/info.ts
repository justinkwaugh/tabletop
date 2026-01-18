import type { GameInfo } from '@tabletop/common'
import { KaivaiConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const KaivaiInfo: GameInfo = {
    id: 'kaivai',
    metadata: {
        name: 'Kaivai',
        designer: 'Anselm and Helge Ostertag',
        description:
            'Over 1000 years ago Polynesians began to colonize the Pacific Ocean. Kaivai or "water eaters," were the men who could safely navigate the ship across the vast ocean to new lands.\n\u00a0\nIn the game Kaivai, players compete for glory by expanding the islands, catching and selling fish, and celebrating the gods. But act fast as the fish will rot, and the shell currency will quickly lose value.',
        year: '2005',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new KaivaiConfigurator()
}
