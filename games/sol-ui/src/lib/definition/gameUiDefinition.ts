import { type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition, HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { SolGameColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/sol-cover.jpg'

export const UiDefinition: GameUiDefinition<SolGameState, HydratedSolGameState> = Object.assign(
    {},
    Definition,
    {
        getTableComponent: async () => {
            return (await import('../components/Table.svelte')).default
        },
        sessionClass: SolGameSession,
        colorizer: new SolGameColorizer(),
        thumbnailUrl: coverImg
    }
)
