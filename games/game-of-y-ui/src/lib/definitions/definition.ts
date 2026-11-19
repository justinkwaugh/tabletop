import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { YInfo } from '@tabletop/game-of-y'
import type { YGameState, HydratedYGameState } from '@tabletop/game-of-y'
import coverImg from '$lib/images/game-of-y-cover.webp'

export const UiDefinition: GameUiDefinition<YGameState, HydratedYGameState> = {
    info: {
        ...YInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).YUiRuntime
    }
}
