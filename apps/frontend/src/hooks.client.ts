import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { registerPwaInstallPrompt } from '$lib/stores/pwaInstallPrompt.svelte.js'
import type { ServerInit } from '@sveltejs/kit'

export const init: ServerInit = async () => {
    registerPwaInstallPrompt()
    await getAppContext().authorizationService.initialize()
}
