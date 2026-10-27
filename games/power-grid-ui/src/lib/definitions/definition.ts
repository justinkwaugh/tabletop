import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { PowerGridInfo } from '@tabletop/power-grid'
import type { HydratedPowerGridGameState, PowerGridProjectedState } from '@tabletop/power-grid'
import coverImg from '$lib/images/power_grid_cover.jpg'

export const UiDefinition: GameUiDefinition<PowerGridProjectedState, HydratedPowerGridGameState> = {
    info: {
        ...PowerGridInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).PowerGridUiRuntime
    }
}
