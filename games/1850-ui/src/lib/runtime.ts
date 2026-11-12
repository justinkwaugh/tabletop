import './styles.css'
import { Definition } from '@tabletop/1850'
import type { HydratedState1850, State1850 } from '@tabletop/1850'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1850 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1850, HydratedState1850> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1850,
    colorizer: new DefaultColorizer()
}
