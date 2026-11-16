import './styles.css'
import { Definition } from '@tabletop/1856'
import type { HydratedState1856, State1856 } from '@tabletop/1856'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { Session1856 } from './session.svelte.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1856, HydratedState1856> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: Session1856,
    colorizer: new DefaultColorizer()
}
