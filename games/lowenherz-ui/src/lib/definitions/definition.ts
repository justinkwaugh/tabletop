import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { LowenherzInfo } from '@tabletop/lowenherz'
import type { LowenherzGameState, HydratedLowenherzGameState } from '@tabletop/lowenherz'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<LowenherzGameState, HydratedLowenherzGameState> = {
    info: {
        ...LowenherzInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).LowenherzUiRuntime
    }
}
