import { Definition } from '@tabletop/the-old-prince'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { GameState, HydratedGameState } from '@tabletop/common'

export const UiDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    info: { ...Definition.info, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export const PrototypeUiDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    ...UiDefinition,
    runtime: async () => {
        const runtime = await UiDefinition.runtime()
        const Table = (await import('./PrototypeTable.svelte')).default
        return {
            ...runtime,
            gameUI: { ...runtime.gameUI, component: Table, load: async () => Table }
        }
    }
}
