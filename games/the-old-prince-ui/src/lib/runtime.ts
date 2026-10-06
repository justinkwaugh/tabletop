import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { HydratedTheOldPrinceState, TheOldPrinceState } from '@tabletop/the-old-prince'
import { Definition } from '@tabletop/the-old-prince'
import { TheOldPrinceSession } from './session.svelte.js'
import './styles.css'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<TheOldPrinceState, HydratedTheOldPrinceState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: TheOldPrinceSession,
    colorizer: new DefaultColorizer()
}
