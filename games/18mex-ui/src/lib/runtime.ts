import './styles.css'
import { Definition } from '@tabletop/18mex'
import type { HydratedStateMex, StateMex } from '@tabletop/18mex'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { SessionMex } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<StateMex, HydratedStateMex> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: SessionMex,
    colorizer: new DefaultColorizer()
}
