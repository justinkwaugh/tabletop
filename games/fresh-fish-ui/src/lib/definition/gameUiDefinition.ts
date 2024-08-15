import { type GameUiDefinition } from '@tabletop/frontend-components'
import { FreshFishDefinition } from '@tabletop/fresh-fish'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte'

export const FreshFishUiDefinition: GameUiDefinition = Object.assign({}, FreshFishDefinition, {
    uiThing: 'Table',
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: FreshFishGameSession
})
