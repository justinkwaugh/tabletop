import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { SarInfo } from '@tabletop/south-african-railroads'
import type { HydratedSarGameState, SarGameState } from '@tabletop/south-african-railroads'
import coverImg from '$lib/images/sar_cover.webp'

export const UiDefinition: GameUiDefinition<SarGameState, HydratedSarGameState> = {
    info: {
        ...SarInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).SarUiRuntime
    }
}
