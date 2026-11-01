import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { SarInfo } from '@tabletop/texas-special'
import type { HydratedSarGameState, SarGameState } from '@tabletop/texas-special'
import coverImg from '$lib/images/sar_cover.svg'

export const UiDefinition: GameUiDefinition<SarGameState, HydratedSarGameState> = {
    info: {
        ...SarInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).SarUiRuntime
    }
}
