import './styles.css'
import { Definition } from '@tabletop/18royalgorge'
import type { HydratedStateRoyalGorge, StateRoyalGorge } from '@tabletop/18royalgorge'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { SessionRoyalGorge } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<StateRoyalGorge, HydratedStateRoyalGorge> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: SessionRoyalGorge,
    colorizer: new DefaultColorizer()
}
