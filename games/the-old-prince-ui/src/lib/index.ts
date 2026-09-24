import coverImg from './images/top-cover.jpg'
import { TheOldPrinceInfo } from '@tabletop/the-old-prince'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

export const UiDefinition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: { ...TheOldPrinceInfo, thumbnailUrl: coverImg },
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
