import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { completeDiscordAuthorization } from '$lib/utils/discordAuthorization'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    await completeDiscordAuthorization({ url, api: getAppContext().api })
}
