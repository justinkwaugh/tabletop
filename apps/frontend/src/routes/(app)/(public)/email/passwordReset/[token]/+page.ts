import { getAppContext } from '$lib/stores/appContext.svelte'
import type { PageLoad } from './$types.js'

export const load: PageLoad = async ({ params }) => {
    const token = params.token
    try {
        const authUser = await getAppContext().api.loginToken(token)
        getAppContext().authorizationService.setSessionUser(authUser)
    } catch {
        return { token, verified: false }
    }

    return {
        token,
        verified: true
    }
}
