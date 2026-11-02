import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { PromontoryPointInfo } from '@tabletop/promontory-point'
import type {
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
} from '@tabletop/promontory-point'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> = {
    info: {
        ...PromontoryPointInfo,
        thumbnailUrl: coverImg,
        // docs/player-votes.md: players may concede or call the game, and a stalled game ends.
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).PromontoryPointUiRuntime
    }
}
