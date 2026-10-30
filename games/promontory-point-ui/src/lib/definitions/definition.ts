import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { PromontoryPointInfo } from '@tabletop/promontory-point'
import type {
    PromontoryPointGameState,
    HydratedPromontoryPointGameState
} from '@tabletop/promontory-point'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<
    PromontoryPointGameState,
    HydratedPromontoryPointGameState
> = {
    info: {
        ...PromontoryPointInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).PromontoryPointUiRuntime
    }
}
