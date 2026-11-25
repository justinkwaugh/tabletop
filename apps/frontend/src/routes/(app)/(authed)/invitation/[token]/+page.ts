import { APIError } from '@tabletop/frontend-components'
import { goto } from '$app/navigation'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
import { toast } from 'svelte-sonner'
import { m } from '$lib/paraglide/messages'

export async function load({ params, url }) {
    console.log('Invitation page load', url)

    await getAppContext().authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })

    const token = params.token

    try {
        const game = await getAppContext().api.checkInvitation(token)
        return {
            game
        }
    } catch (e) {
        if (e instanceof APIError) {
            if (e.name === 'InvitationNotFound') {
                onceMounted(() => {
                    toast.error(m.auth_invitation_not_found())
                })
                await goto('/dashboard')
                return
            } else if (e.name === 'Unauthorized') {
                onceMounted(() => {
                    toast.error(m.auth_invitation_wrong_user())
                })
                await goto('/dashboard')
                return
            } else if (e.name === 'UserAlreadyJoinedError') {
                // TODO: Goto the game
                await goto('/dashboard')
                return
            } else if (e.name === 'UserAlreadyDeclinedError') {
                onceMounted(() => {
                    toast.error(m.auth_invitation_already_declined())
                })
                await goto('/dashboard')
                return
            }
        }

        onceMounted(() => {
            toast.error(m.auth_invitation_invalid())
        })
        await goto('/dashboard')
    }
}
