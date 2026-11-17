import { Info1867 } from '@tabletop/1867'
import type { HydratedState1867, State1867 } from '@tabletop/1867'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1867, HydratedState1867> = {
    info: { ...Info1867, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
