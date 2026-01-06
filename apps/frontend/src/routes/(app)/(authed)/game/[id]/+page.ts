import { goto } from '$app/navigation'
import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { toast } from 'svelte-sonner'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ params, url }) => {
    const appContext = getAppContext()
    await appContext.authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    const { id } = params

    try {
        const { game, actions } = await appContext.gameService.loadGame(id)
        if (!game) {
            onceMounted(() => {
                toast.error('The specified game was not found')
            })
            await goto('/dashboard')
            return
        }

        if (!game.state) {
            onceMounted(() => {
                toast.error('The specified game has not been started')
            })
            await goto('/dashboard')
            return
        }

        const definition = appContext.libraryService.getTitle(game.typeId)
        if (!definition) {
            onceMounted(() => {
                toast.error('The specified game is not supported')
            })
            await goto('/dashboard')
            return
        }

        return {
            gameSession: new definition.sessionClass({
                gameService: appContext.gameService,
                authorizationService: appContext.authorizationService,
                notificationService: appContext.notificationService,
                chatService: appContext.chatService,
                api: appContext.api,
                definition,
                game,
                state: game.state,
                actions
            })
        }
    } catch (e) {
        console.log(e)
        onceMounted(() => {
            toast.error('Unable to load the game')
        })
        await goto('/dashboard')
    }
}
