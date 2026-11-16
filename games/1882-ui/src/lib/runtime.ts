import './styles.css'
import { Definition } from '@tabletop/1882'
import type { HydratedState1882, State1882 } from '@tabletop/1882'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1882 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1882, HydratedState1882> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1882,
    colorizer: new DefaultColorizer()
}
