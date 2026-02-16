import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { IndonesiaInfo } from '@tabletop/indonesia'
import type { IndonesiaGameState, HydratedIndonesiaGameState } from '@tabletop/indonesia'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<IndonesiaGameState, HydratedIndonesiaGameState> = {
    info: {
        ...IndonesiaInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).IndonesiaUiRuntime
    }
}
