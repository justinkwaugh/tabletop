import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { registerPwaInstallPrompt } from '$lib/stores/pwaInstallPrompt.svelte.js'
import { recoverFailedImages } from '$lib/utils/failedImageRecovery.js'
import type { ServerInit } from '@sveltejs/kit'
import { setDocumentLanguage } from '$lib/i18n/locale.js'

export const init: ServerInit = async () => {
    recoverFailedImages(document, window)
    registerPwaInstallPrompt()
    await getAppContext().authorizationService.initialize()
    setDocumentLanguage(document)
}
