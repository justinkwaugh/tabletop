import { getAppContext } from '$lib/stores/appContext.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
    const { api, authorizationService, catalogService } = getAppContext()
    await Promise.all([authorizationService.initialize(), catalogService.whenReady()])
    try {
        const game = await api.getPublicGamePreview(params.id)
        return { game, loadFailed: false }
    } catch {
        return { game: undefined, loadFailed: true }
    }
}
