import { Shikoku1889Info } from '@tabletop/shikoku-1889'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

export const UiDefinition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: { ...Shikoku1889Info, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export const PrototypeUiDefinition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState> = {
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
