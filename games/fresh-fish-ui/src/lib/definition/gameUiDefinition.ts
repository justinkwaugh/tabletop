import { type GameUiDefinition } from '@tabletop/frontend-components'
import { Definition } from '@tabletop/fresh-fish'
import { FreshFishGameSession } from '../stores/FreshFishGameSession.svelte'
import { FreshFishColorizer } from './gameColorizer.js'
import coverImg from '$lib/images/fresh-fish-cover.jpg'

export const UiDefinition: GameUiDefinition = Object.assign({}, Definition, {
    getTableComponent: async () => {
        return (await import('../components/Table.svelte')).default
    },
    sessionClass: FreshFishGameSession,
    colorizer: new FreshFishColorizer(),
    thumbnailUrl: coverImg
})
