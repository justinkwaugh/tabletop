import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, params }) => {
    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    const param = url.searchParams.get('season')
    const season = param === null ? NaN : Number(param)
    return { id: params.id, season: Number.isInteger(season) && season >= 0 ? season : undefined }
}
