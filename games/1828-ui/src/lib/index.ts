import { Info1828 } from '@tabletop/1828'
import type { HydratedState1828, State1828 } from '@tabletop/1828'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1828, HydratedState1828> = {
    info: { ...Info1828, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
