import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { HydratedTheOldPrinceState, TheOldPrinceState } from '@tabletop/the-old-prince'
import { TheOldPrinceInfo } from '@tabletop/the-old-prince'
import coverImg from './images/top-cover.jpg'

export const UiDefinition: GameUiDefinition<TheOldPrinceState, HydratedTheOldPrinceState> = {
    info: { ...TheOldPrinceInfo, thumbnailUrl: coverImg },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export const PrototypeUiDefinition: GameUiDefinition<TheOldPrinceState, HydratedTheOldPrinceState> =
    {
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
