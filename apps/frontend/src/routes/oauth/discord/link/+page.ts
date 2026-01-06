import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ url }) => {
    const code = url.searchParams.get('code')
    if (!code) {
        return
    }

    const newUser = await getAppContext().api.linkDiscord(code)
    const channel = new BroadcastChannel('userUpdated')
    channel.postMessage({ user: newUser })
}
