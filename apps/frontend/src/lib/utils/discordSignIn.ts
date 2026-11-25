import type { DiscordAuthorizationPurpose } from '@tabletop/frontend-components'
import { reauthentication } from '$lib/stores/reauthentication.svelte'
import { m } from '$lib/paraglide/messages'
import {
    openDiscordAuthorization,
    openPreparedDiscordAuthorization,
    prepareDiscordLink,
    type DiscordAuthorizationApi,
    type DiscordAuthorizationOutcome,
    type DiscordAuthorizationSuccess
} from './discordAuthorization'

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
            await reauthentication.run({
                purpose: 'link-discord',
                retry: attempt,
                requiresUserGesture: true,
                prepare: async () => {
                    const startedAt = Date.now()
                    const started = await prepareDiscordLink(api)
                    return {
                        requiresUserGesture: !navigator.userActivation?.isActive,
                        expiresAt: startedAt + started.expiresInSeconds * 1000,
                        run: async () => {
                            notifyCompletion(await openPreparedDiscordAuthorization(started))
                        }
                    }
                }
            })
        } else {
            await attempt()
        }
    } catch (error) {
        report(error instanceof Error ? error.message : m.auth_discord_authorization_failed())
    }
}
