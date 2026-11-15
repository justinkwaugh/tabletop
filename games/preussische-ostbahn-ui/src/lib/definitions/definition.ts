import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { OstbahnInfo } from '@tabletop/preussische-ostbahn'
import type { HydratedOstbahnGameState, OstbahnGameState } from '@tabletop/preussische-ostbahn'
import coverImg from '$lib/images/preussische_ostbahn_cover.webp'

export const UiDefinition: GameUiDefinition<OstbahnGameState, HydratedOstbahnGameState> = {
    info: {
        ...OstbahnInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).OstbahnUiRuntime
    }
}
