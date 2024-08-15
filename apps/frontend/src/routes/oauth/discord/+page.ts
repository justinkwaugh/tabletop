import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function load({ url }) {
    const code = url.searchParams.get('code')
    if (!code) {
        return
    }

    const newUser = await getAppContext().api.loginDiscord(code)
    const channel = new BroadcastChannel('login')
    channel.postMessage({ status: 'success', user: newUser })
}
