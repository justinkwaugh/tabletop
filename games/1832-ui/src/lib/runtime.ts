import './styles.css'
import { Definition } from '@tabletop/1832'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { EighteenThirtyTwoSession } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: EighteenThirtyTwoSession,
    colorizer: new DefaultColorizer()
}
