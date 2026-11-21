import './styles.css'
import { Definition } from '@tabletop/18usa'
import type { EighteenUSAState, HydratedEighteenUSAState } from '@tabletop/18usa'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import Table from './Table.svelte'
import { EighteenUSASession } from './session.svelte.js'

export const UiRuntime: GameUIRuntime<EighteenUSAState, HydratedEighteenUSAState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: EighteenUSASession,
    colorizer: new DefaultColorizer()
}
