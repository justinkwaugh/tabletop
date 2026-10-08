import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { KoggeInfo } from '@tabletop/kogge'
import type { HydratedKoggeGameState, KoggeProjectedState } from '@tabletop/kogge'
import coverImg from '$lib/images/kogge_cover.jpg'

export const UiDefinition: GameUiDefinition<KoggeProjectedState, HydratedKoggeGameState> = {
    info: {
        ...KoggeInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).KoggeUiRuntime
    }
}
