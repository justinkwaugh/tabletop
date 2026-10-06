import './styles.css'
import {
    Definition,
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState
} from '@tabletop/1846'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { EighteenFortySixSession } from './session.svelte.js'
import Table from './Table.svelte'
export const UiRuntime: GameUIRuntime<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: EighteenFortySixSession,
    colorizer: new DefaultColorizer()
}
