import './styles.css'
import { Definition, type HydratedState1833NE, type State1833NE } from '@tabletop/1833ne'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import Table from './Table.svelte'
import { Session1833NE } from './session.svelte.js'

export const UiRuntime: GameUIRuntime<State1833NE, HydratedState1833NE> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1833NE,
    colorizer: new DefaultColorizer()
}
