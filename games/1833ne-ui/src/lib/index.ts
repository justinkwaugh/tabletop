import thumbnailUrl from './images/cover.webp'
import { Info1833NE, type HydratedState1833NE, type State1833NE } from '@tabletop/1833ne'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'

export const UiDefinition: GameUiDefinition<State1833NE, HydratedState1833NE> = {
    info: { ...Info1833NE, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
