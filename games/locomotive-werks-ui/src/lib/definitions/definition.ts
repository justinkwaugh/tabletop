import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { LwInfo } from '@tabletop/locomotive-werks'
import type { HydratedLwGameState, LwProjectedState } from '@tabletop/locomotive-werks'
import coverImg from '$lib/images/lw_cover.webp'

export const UiDefinition: GameUiDefinition<LwProjectedState, HydratedLwGameState> = {
    info: {
        ...LwInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).LwUiRuntime
    }
}
