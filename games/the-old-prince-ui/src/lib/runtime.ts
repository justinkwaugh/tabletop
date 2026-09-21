import './styles.css'
import { Definition } from '@tabletop/the-old-prince'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { TheOldPrinceSession } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenXXState, HydratedEighteenXXState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: TheOldPrinceSession,
    colorizer: new DefaultColorizer()
}
