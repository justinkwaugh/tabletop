import './styles.css'
import { Definition } from '@tabletop/1862'
import type { HydratedState1862, State1862 } from '@tabletop/1862'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1862 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1862, HydratedState1862> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1862,
    colorizer: new DefaultColorizer()
}
