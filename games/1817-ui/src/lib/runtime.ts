import './styles.css'
import { Definition } from '@tabletop/1817'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
import Table from './Table.svelte'
import { EighteenSeventeenSession } from './session.svelte.js'

export const UiRuntime: GameUIRuntime<EighteenSeventeenState, HydratedEighteenSeventeenState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: EighteenSeventeenSession,
    colorizer: new DefaultColorizer()
}
