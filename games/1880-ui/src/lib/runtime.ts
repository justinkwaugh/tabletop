import './styles.css'
import { Definition } from '@tabletop/1880'
import type { HydratedState1880, State1880 } from '@tabletop/1880'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1880 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1880, HydratedState1880> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1880,
    colorizer: new DefaultColorizer()
}
