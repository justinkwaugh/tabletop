import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { LowenherzInfo } from '@tabletop/lowenherz'
import type { LowenherzProjectedState, HydratedLowenherzGameState } from '@tabletop/lowenherz'
import coverImg from '$lib/images/lowenherz-cover.jpg'

export const UiDefinition: GameUiDefinition<LowenherzProjectedState, HydratedLowenherzGameState> = {
    info: {
        ...LowenherzInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).LowenherzUiRuntime
    }
}
