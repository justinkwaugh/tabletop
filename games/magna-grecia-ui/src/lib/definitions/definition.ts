import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { MagnaGreciaInfo } from '@tabletop/magna-grecia'
import type { HydratedMagnaGreciaGameState, MagnaGreciaGameState } from '@tabletop/magna-grecia'
import coverImg from '$lib/images/magna_grecia_cover.svg'

export const UiDefinition: GameUiDefinition<MagnaGreciaGameState, HydratedMagnaGreciaGameState> = {
    info: {
        ...MagnaGreciaInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).MagnaGreciaUiRuntime
    }
}
