import './styles.css'
import { Definition } from '@tabletop/18chesapeake'
import type { HydratedStateChesapeake, StateChesapeake } from '@tabletop/18chesapeake'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { SessionChesapeake } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<StateChesapeake, HydratedStateChesapeake> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: SessionChesapeake,
    colorizer: new DefaultColorizer()
}
