import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { UrbinoInfo } from '@tabletop/urbino'
import type { UrbinoGameState, HydratedUrbinoGameState } from '@tabletop/urbino'

export const UiDefinition: GameUiDefinition<UrbinoGameState, HydratedUrbinoGameState> = {
    info: {
        ...UrbinoInfo,
        thumbnailUrl: ''
    },
    runtime: async () => {
        return (await import('./runtime.js')).UrbinoUiRuntime
    }
}
