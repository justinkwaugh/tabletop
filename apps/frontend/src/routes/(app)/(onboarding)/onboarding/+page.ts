import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'

export async function load({ url }) {
    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.Onboarding,
        intendedUrl: url
    })
}
