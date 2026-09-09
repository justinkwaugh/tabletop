import { Definition } from '@tabletop/the-old-prince'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { GameState, HydratedGameState } from '@tabletop/common'

export const UiDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    info: { ...Definition.info, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
