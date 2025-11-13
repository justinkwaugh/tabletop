import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { ServerInit } from '@sveltejs/kit'

export const init: ServerInit = async () => {
    await getAppContext().authorizationService.initialize()
}
