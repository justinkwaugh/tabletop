import { DefaultStateLogger, type GameDefinition } from '@tabletop/common'
import type { HydratedSampleGameState, SampleGameState } from '../model/gameState.js'
import { SampleHydrator } from './hydrator.js'
import { SampleGameInitializer } from './initializer.js'
import { SampleApiActions } from './apiActions.js'
import { SampleStateHandlers } from './stateHandlers.js'
import { SampleColors } from './colors.js'
import { SampleConfigurator } from './configurator.js'

// The export MUST be named Definition and be of type GameDefinition
export const Definition: GameDefinition<SampleGameState, HydratedSampleGameState> =
    <GameDefinition<SampleGameState, HydratedSampleGameState>>{
    info: {
        id: 'sample',
        metadata: {
            name: 'Sample Game',
            designer: 'No one really',
            description:
                'Sample Game is not even a game, just a sample for how to build games on this platform.',
            year: '2026',
            minPlayers: 2,
            maxPlayers: 5,
            defaultPlayerCount: 4,
            beta: true
        },
        configurator: new SampleConfigurator()
    },
    runtime: {
        initializer: new SampleGameInitializer(),
        hydrator: new SampleHydrator(),
        stateHandlers: SampleStateHandlers,
        apiActions: SampleApiActions,
        playerColors: SampleColors,
        stateLogger: new DefaultStateLogger() // This never really got used, but it could do some custom logging if desired
    }
}
