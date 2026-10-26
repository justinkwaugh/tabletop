import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { SolInfo } from '@tabletop/sol'
import type { HydratedSolGameState, SolGameState } from '@tabletop/sol'
import coverImg from '$lib/images/sol-cover.jpg'

export const UiDefinition: GameUiDefinition<SolGameState, HydratedSolGameState> = {
    info: {
        ...SolInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./definition/gameUiRuntime.js')).SolUiRuntime
    }
}
