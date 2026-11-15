import './styles.css'
import { Definition } from '@tabletop/1861'
import type { HydratedState1861, State1861 } from '@tabletop/1861'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1861 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1861, HydratedState1861> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1861,
    colorizer: new DefaultColorizer()
}
