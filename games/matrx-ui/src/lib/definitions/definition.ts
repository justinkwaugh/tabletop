import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { MatrxInfo } from '@tabletop/matrx'
import type { MatrxGameState, HydratedMatrxGameState } from '@tabletop/matrx'
import coverImg from '$lib/images/matrx-cover.png'

export const UiDefinition: GameUiDefinition<MatrxGameState, HydratedMatrxGameState> = {
    info: {
        ...MatrxInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).MatrxUiRuntime
    }
}
