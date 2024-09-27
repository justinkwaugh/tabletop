import { type GameUiDefinition } from '@tabletop/frontend-components'
import { FreshFishDefinition } from '@tabletop/fresh-fish'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte'
import { FreshFishColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/fresh-fish-cover.jpg'

export const FreshFishUiDefinition: GameUiDefinition = Object.assign({}, FreshFishDefinition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: FreshFishGameSession,
    colorizer: new FreshFishColorizer(),
    thumbnailUrl: coverImg
})
