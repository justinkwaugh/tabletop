import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { StellarHorizonsInfo } from '@tabletop/stellar-horizons-2'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '@tabletop/stellar-horizons-2'
import coverImg from '$lib/images/stellar_horizons_2_cover.webp'

export const UiDefinition: GameUiDefinition<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> = {
    info: {
        ...StellarHorizonsInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).StellarHorizonsUiRuntime
    }
}
