import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { FreshFishInfo } from '@tabletop/fresh-fish'
import type { FreshFishGameState, HydratedFreshFishGameState } from '@tabletop/fresh-fish'
import coverImg from '$lib/images/fresh-fish-cover.jpg'

export const UiDefinition: GameUiDefinition<FreshFishGameState, HydratedFreshFishGameState> = {
    info: {
        ...FreshFishInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).FreshFishUiRuntime
    }
}
