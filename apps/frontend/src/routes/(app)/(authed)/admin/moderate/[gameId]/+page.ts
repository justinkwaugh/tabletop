import { error } from '@sveltejs/kit'
import type { Game, GameChatMessage } from '@tabletop/common'
import { authorizeAdminRoute } from '$lib/utils/adminRoute.js'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

type ModerationData = {
    game?: Game
    messages: GameChatMessage[]
    messageId?: string
}

export const load: PageLoad = async ({ url, params }): Promise<ModerationData> => {
    if (!(await authorizeAdminRoute(url))) return { messages: [] }
    const { api } = getAppContext()
    try {
        const [{ game }, chat] = await Promise.all([
            api.getGame(params.gameId),
            api.getGameChat(params.gameId)
        ])
        return {
            game,
            messages: chat.messages,
            messageId: url.searchParams.get('message') ?? undefined
        }
    } catch {
        error(404, 'The game could not be loaded.')
    }
}
