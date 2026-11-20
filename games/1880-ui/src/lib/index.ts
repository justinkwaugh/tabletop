import { Info1880 } from '@tabletop/1880'
import type { HydratedState1880, State1880 } from '@tabletop/1880'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1880, HydratedState1880> = {
    info: { ...Info1880, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
