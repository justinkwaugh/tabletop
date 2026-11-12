import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { MedinaInfo } from '@tabletop/medina'
import type { HydratedMedinaGameState, MedinaProjectedState } from '@tabletop/medina'
import coverImg from '$lib/images/medina-cover.webp'

export const UiDefinition: GameUiDefinition<MedinaProjectedState, HydratedMedinaGameState> = {
    info: {
        ...MedinaInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).MedinaUiRuntime
    }
}
