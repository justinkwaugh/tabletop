import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function load() {
    // This is to ensure that the session user is available in the header
    await getAppContext().authorizationService.initialize()
}
