import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { ReefEncounterInfo } from '@tabletop/reef-encounter'
import type {
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
} from '@tabletop/reef-encounter'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<
    ReefEncounterProjectedState,
    HydratedReefEncounterGameState
> = {
    info: {
        ...ReefEncounterInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).ReefEncounterUiRuntime
    }
}
