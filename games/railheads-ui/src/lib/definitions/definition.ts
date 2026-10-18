import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { RailheadsInfo } from '@tabletop/railheads'
import type { HydratedRailheadsGameState, RailheadsProjectedState } from '@tabletop/railheads'
import coverImg from '$lib/images/railheads_cover.webp'

export const UiDefinition: GameUiDefinition<RailheadsProjectedState, HydratedRailheadsGameState> = {
    info: {
        ...RailheadsInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).RailheadsUiRuntime
    }
}
