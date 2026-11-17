import './styles.css'
import { Definition } from '@tabletop/1867'
import type { HydratedState1867, State1867 } from '@tabletop/1867'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1867 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1867, HydratedState1867> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1867,
    colorizer: new DefaultColorizer()
}
