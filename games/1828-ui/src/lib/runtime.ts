import './styles.css'
import { Definition } from '@tabletop/1828'
import type { HydratedState1828, State1828 } from '@tabletop/1828'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1828 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1828, HydratedState1828> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1828,
    colorizer: new DefaultColorizer()
}
