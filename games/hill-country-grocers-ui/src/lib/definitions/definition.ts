import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { HcgInfo } from '@tabletop/hill-country-grocers'
import type { HcgGameState, HydratedHcgGameState } from '@tabletop/hill-country-grocers'
import coverImg from '$lib/images/hcg_cover.jpg'

export const UiDefinition: GameUiDefinition<HcgGameState, HydratedHcgGameState> = {
    info: {
        ...HcgInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).HcgUiRuntime
    }
}
