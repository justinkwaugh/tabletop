import './styles.css'
import { Definition } from '@tabletop/1822'
import type { HydratedState1822, State1822 } from '@tabletop/1822'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1822 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1822, HydratedState1822> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1822,
    colorizer: new DefaultColorizer()
}
