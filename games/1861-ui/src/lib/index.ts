import { Info1861 } from '@tabletop/1861'
import type { HydratedState1861, State1861 } from '@tabletop/1861'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1861, HydratedState1861> = {
    info: { ...Info1861, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
