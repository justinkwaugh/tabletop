import { Info1870 } from '@tabletop/1870'
import type { HydratedState1870, State1870 } from '@tabletop/1870'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1870, HydratedState1870> = {
    info: { ...Info1870, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
