import './styles.css'
import { Definition } from '@tabletop/1870'
import type { HydratedState1870, State1870 } from '@tabletop/1870'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1870 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1870, HydratedState1870> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1870,
    colorizer: new DefaultColorizer()
}
