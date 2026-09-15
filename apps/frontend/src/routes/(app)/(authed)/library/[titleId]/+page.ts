import { error } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
    const { authorizationService, libraryService } = getAppContext()
    await authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    await libraryService.whenReady()
    const user = authorizationService.getSessionUser()
    const title =
        user && libraryService.getTitles(user).find((title) => title.info.id === params.titleId)
    if (!title) error(404, 'This game is not available in your library.')
    return { title }
}
