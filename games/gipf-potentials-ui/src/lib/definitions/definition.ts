import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { GipfPotentialsInfo } from '@tabletop/gipf-potentials'
import type {
    GipfPotentialsGameState,
    HydratedGipfPotentialsGameState
} from '@tabletop/gipf-potentials'
import coverImg from '$lib/images/gipf-potentials-cover.png'

export const UiDefinition: GameUiDefinition<
    GipfPotentialsGameState,
    HydratedGipfPotentialsGameState
> = {
    info: {
        ...GipfPotentialsInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).GipfPotentialsUiRuntime
    }
}
