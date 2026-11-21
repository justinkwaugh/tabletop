import thumbnailUrl from './images/cover.webp'
import { EighteenUSAInfo } from '@tabletop/18usa'
import type { EighteenUSAState, HydratedEighteenUSAState } from '@tabletop/18usa'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'

export const UiDefinition: GameUiDefinition<EighteenUSAState, HydratedEighteenUSAState> = {
    info: { ...EighteenUSAInfo, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
