import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { SantiagoInfo } from '@tabletop/santiago'
import type { SantiagoGameState, HydratedSantiagoGameState } from '@tabletop/santiago'

export const UiDefinition: GameUiDefinition<SantiagoGameState, HydratedSantiagoGameState> = {
    info: {
        ...SantiagoInfo,
        thumbnailUrl: ''
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).SantiagoUiRuntime
    },
    createGameDefaults: {
        name: 'Dev',
        additionalPlayerNames: ['Player2', 'Player3', 'Player4'],
        config: { palmTrees: false }
    }
}
