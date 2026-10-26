import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { OathInfo } from '@tabletop/oath'
import type { OathProjectedState, HydratedOathGameState } from '@tabletop/oath'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<OathProjectedState, HydratedOathGameState> = {
    info: {
        ...OathInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).OathUiRuntime
    }
}
