import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { HexInfo } from '@tabletop/hex'
import type { HexGameState, HydratedHexGameState } from '@tabletop/hex'
import coverImg from '$lib/images/hex-cover.webp'

export const UiDefinition: GameUiDefinition<HexGameState, HydratedHexGameState> = {
    info: {
        ...HexInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).HexUiRuntime
    }
}
