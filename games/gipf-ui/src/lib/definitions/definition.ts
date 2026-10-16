import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { GipfInfo } from '@tabletop/gipf'
import type { GipfGameState, HydratedGipfGameState } from '@tabletop/gipf'
import coverImg from '$lib/images/gipf-cover.png'

export const UiDefinition: GameUiDefinition<GipfGameState, HydratedGipfGameState> = {
    info: {
        ...GipfInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).GipfUiRuntime
    }
}
