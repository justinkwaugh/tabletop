import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { PunctInfo } from '@tabletop/punct'
import type { PunctGameState, HydratedPunctGameState } from '@tabletop/punct'
import coverImg from '$lib/images/punct-cover.png'

export const UiDefinition: GameUiDefinition<PunctGameState, HydratedPunctGameState> = {
    info: {
        ...PunctInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).PunctUiRuntime
    }
}
