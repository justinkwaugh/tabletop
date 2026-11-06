import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { FeudumInfo } from '@tabletop/feudum'
import type { FeudumProjectedState, HydratedFeudumGameState } from '@tabletop/feudum'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<FeudumProjectedState, HydratedFeudumGameState> = {
    info: {
        ...FeudumInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).FeudumUiRuntime
    }
}
