import { Info1850 } from '@tabletop/1850'
import type { HydratedState1850, State1850 } from '@tabletop/1850'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<State1850, HydratedState1850> = {
    info: { ...Info1850, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
