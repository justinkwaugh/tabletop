import type { DiscordAuthorizationPurpose } from '@tabletop/frontend-components'
import { reauthentication } from '$lib/stores/reauthentication.svelte'
import {
    openDiscordAuthorization,
    openPreparedDiscordAuthorization,
    prepareDiscordLink,
    type DiscordAuthorizationApi,
    type DiscordAuthorizationOutcome,
    type DiscordAuthorizationSuccess
} from './discordAuthorization'

export const DISCORD_LINK_DESCRIPTION = 'add Discord as another way to sign in to your account'

// Linking goes through the Recent Authentication prompt: a refusal at either end of the popup
// round trip asks the person to confirm, and the retry begins a fresh authorization attempt.
export async function signInWithDiscord({
    purpose,
    api,
    oncomplete,
    report
}: {
    purpose: DiscordAuthorizationPurpose
    api: DiscordAuthorizationApi
    oncomplete?: (result: DiscordAuthorizationSuccess) => void
    report: (message: string) => void
}): Promise<void> {
    const notifyCompletion = (result: DiscordAuthorizationOutcome) => {
        if (result.outcome === 'success') oncomplete?.(result)
    }
    const attempt = async () => {
        notifyCompletion(await openDiscordAuthorization({ purpose, api }))
    }
    try {
        if (purpose === 'link') {
            await reauthentication.run(
                {
                    description: DISCORD_LINK_DESCRIPTION,
                    retry: attempt,
                    requiresUserGesture: true
                },
                async () => {
                    const started = await prepareDiscordLink(api)
                    return {
                        requiresUserGesture: !navigator.userActivation?.isActive,
                        run: async () => {
                            notifyCompletion(await openPreparedDiscordAuthorization(started))
                        }
                    }
                }
            )
        } else {
            await attempt()
        }
    } catch (error) {
        report(error instanceof Error ? error.message : 'Discord authorization failed')
    }
}
