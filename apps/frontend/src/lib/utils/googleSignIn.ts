import type { TabletopApiPublic } from '@tabletop/frontend-components'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import { reauthentication } from '$lib/stores/reauthentication.svelte'

export type GoogleSignInMode = 'login' | 'link' | 'reauthenticate'
export type GoogleSignInApi = Pick<
    TabletopApiPublic,
    'loginGoogle' | 'linkGoogle' | 'reauthenticateGoogle'
>
export type GoogleSignInSession = Pick<AuthorizationService, 'onLogin' | 'setSessionUser'>

export const GOOGLE_LINK_DESCRIPTION = 'link your Google account'

export async function signInWithGoogle({
    credential,
    mode,
    api,
    session,
    oncomplete,
    report
}: {
    credential: string
    mode: GoogleSignInMode
    api: GoogleSignInApi
    session: GoogleSignInSession
    oncomplete?: () => void
    report: (message: string) => void
}): Promise<void> {
    try {
        switch (mode) {
            case 'login':
                await session.onLogin(await api.loginGoogle(credential))
                break
            case 'link':
                await reauthentication.run({
                    description: GOOGLE_LINK_DESCRIPTION,
                    retry: async () => {
                        session.setSessionUser(await api.linkGoogle(credential))
                        oncomplete?.()
                    }
                })
                break
            case 'reauthenticate':
                await api.reauthenticateGoogle(credential)
                oncomplete?.()
                break
        }
    } catch (error) {
        report(error instanceof Error ? error.message : 'Google sign-in failed')
    }
}
