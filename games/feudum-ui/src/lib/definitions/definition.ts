import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { FeudumInfo } from '@tabletop/feudum'
import type { FeudumProjectedState, HydratedFeudumGameState } from '@tabletop/feudum'
import { suppliedCover } from '$lib/art/cover.js'

export const UiDefinition: GameUiDefinition<FeudumProjectedState, HydratedFeudumGameState> = {
    info: {
        ...FeudumInfo,
        // The publisher's cover, or none where the asset folder holds no cover: no drawn cover
        // stands in for the print.
        thumbnailUrl: suppliedCover ?? ''
    },
    runtime: async () => {
        return (await import('./runtime.js')).FeudumUiRuntime
    }
}
