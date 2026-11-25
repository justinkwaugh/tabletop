import { error, isHttpError } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { BridgedContext } from '@tabletop/frontend-components'
import { gamePageDependency } from '$lib/utils/gamePage.js'
import { m } from '$lib/paraglide/messages'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ params, url, depends }) => {
    depends(gamePageDependency(params.id))
    const appContext = getAppContext()
    await appContext.authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    void appContext.gameService.loadGames().catch((error) => {
        console.error('Error loading games for turn navigation', error)
    })

    const { id } = params

    try {
        let { game, actions, historyComplete } = await appContext.gameService.loadGame(id, {
            includeActions: false
        })
        if (!game) {
            error(404, m.games_page_not_found())
        }

        if (!game.state) {
            error(409, m.games_page_not_started())
        }

        await appContext.libraryService.whenReady()
        const definition = appContext.libraryService.getTitle(game.typeId)
        if (!definition) {
            error(404, m.games_page_not_supported())
        }

        const runtime = await definition.runtime()
        const sessionClass = runtime.sessionClass
        if (historyComplete === false && !sessionClass.supportsDeferredHistory) {
            const complete = await appContext.gameService.loadGame(id)
            game = complete.game
            actions = complete.actions
            historyComplete = complete.historyComplete
            if (!game?.state) error(409, m.games_page_no_longer_available())
        }

        const bridgedContext = new BridgedContext({
            authorizationService: appContext.authorizationService,
            gameService: appContext.gameService,
            chatService: appContext.chatService,
            gameId: game.id
        })
        return {
            game,
            gameSession: new sessionClass({
                gameService: appContext.gameService,
                bridgedContext: bridgedContext,
                notificationService: appContext.notificationService,
                chatService: appContext.chatService,
                api: appContext.api,
                runtime: runtime,
                game,
                state: game.state,
                actions,
                historyComplete
            })
        }
    } catch (e) {
        if (isHttpError(e)) {
            throw e
        }
        console.error(e)
        error(500, m.games_page_load_failed())
    }
}
