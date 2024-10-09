import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import { KaivaiHydrator } from './hydrator.js'
import { KaivaiGameInitializer } from './gameInitializer.js'
import { KaivaiApiActions } from './apiActions.js'
import { KaivaiStateHandlers } from './stateHandlers.js'
import { KaivaiColors } from './colors.js'
import { KaivaiGameConfigOptions } from './gameConfig.js'

export const KaivaiDefinition = <GameDefinition>{
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
        beta: false
    },

    initializer: new KaivaiGameInitializer(),
    hydrator: new KaivaiHydrator(),

    stateHandlers: KaivaiStateHandlers,
    apiActions: KaivaiApiActions,
    playerColors: KaivaiColors,

    configOptions: KaivaiGameConfigOptions,
    stateLogger: new DefaultStateLogger()
}
