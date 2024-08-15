import { redirect } from '@sveltejs/kit'
import { getAppContext } from '$lib/stores/appContext.svelte'

// Though we will verify the token with the password reset call,
// we do it here early so the user knows immediately that the token is valid
export async function load({ params }) {
    const token = params.token
    try {
        const authUser = await getAppContext().api.loginToken(token)
        getAppContext().authorizationService.setSessionUser(authUser)
    } catch (e) {
        //TODO: add a toast message
        return redirect(302, '/login')
    }

    return {
        token
    }
}
