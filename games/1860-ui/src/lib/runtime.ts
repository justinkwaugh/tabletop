import './styles.css'
import { Definition } from '@tabletop/1860'
import type { HydratedState1860, State1860 } from '@tabletop/1860'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1860 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1860, HydratedState1860> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1860,
    colorizer: new DefaultColorizer()
}
