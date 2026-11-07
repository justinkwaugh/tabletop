import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { FeudumInfo } from '@tabletop/feudum'
import type { FeudumProjectedState, HydratedFeudumGameState } from '@tabletop/feudum'
import { CoverAsset, assetUrl } from '$lib/art/assetMap.js'
import drawnCover from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<FeudumProjectedState, HydratedFeudumGameState> = {
    info: {
        ...FeudumInfo,
        thumbnailUrl: assetUrl(CoverAsset) ?? drawnCover
    },
    runtime: async () => {
        return (await import('./runtime.js')).FeudumUiRuntime
    }
}
