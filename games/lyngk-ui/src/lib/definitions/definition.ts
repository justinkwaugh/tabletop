import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { LyngkInfo } from '@tabletop/lyngk'
import type { LyngkGameState, HydratedLyngkGameState } from '@tabletop/lyngk'
import coverImg from '$lib/images/lyngk-cover.webp'

export const UiDefinition: GameUiDefinition<LyngkGameState, HydratedLyngkGameState> = {
    info: {
        ...LyngkInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).LyngkUiRuntime
    }
}
