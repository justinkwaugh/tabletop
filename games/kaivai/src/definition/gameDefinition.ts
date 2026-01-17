import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { HydratedKaivaiGameState, KaivaiGameState } from '../model/gameState.js'
import { KaivaiHydrator } from './hydrator.js'
import { KaivaiGameInitializer } from './gameInitializer.js'
import { KaivaiApiActions } from './apiActions.js'
import { KaivaiStateHandlers } from './stateHandlers.js'
import { KaivaiColors } from './colors.js'
import { KaivaiConfigurator } from './configurator.js'

export const Definition = <GameDefinition<KaivaiGameState, HydratedKaivaiGameState>>{
    info: {
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
            version: '0.0.1',
            beta: false
        },
        configurator: new KaivaiConfigurator()
    },
    runtime: {
        initializer: new KaivaiGameInitializer(),
        hydrator: new KaivaiHydrator(),
        stateHandlers: KaivaiStateHandlers,
        apiActions: KaivaiApiActions,
        playerColors: KaivaiColors,
        stateLogger: new DefaultStateLogger()
    }
}
