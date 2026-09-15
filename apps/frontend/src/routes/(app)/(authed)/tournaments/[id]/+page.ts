import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, params }) => {
    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    return { id: params.id }
}
