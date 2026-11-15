import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, UserStatus, type User } from '@tabletop/common'

vi.mock('@tabletop/frontend-components', () => ({
    APIError: class APIError extends Error {
        constructor({ name, message }: { name: string; message: string }) {
            super(message)
            this.name = name
        }
    }
}))
import { APIError } from '@tabletop/frontend-components'
import { reauthentication } from '$lib/stores/reauthentication.svelte'
import {
    GOOGLE_LINK_DESCRIPTION,
    signInWithGoogle,
    type GoogleSignInApi,
    type GoogleSignInMode,
    type GoogleSignInSession
} from './googleSignIn'

const user: User = {
    id: 'account-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: ['google:holder']
}

const REFUSED = 'The proof does not belong to the signed-in Account'

function flow(mode: GoogleSignInMode) {
    const api = {
        loginGoogle: vi.fn(async () => user),
        linkGoogle: vi.fn(async () => user),
        reauthenticateGoogle: vi.fn(async () => {})
    }
    const remote: GoogleSignInApi = api
    const session = { onLogin: vi.fn(async () => {}), setSessionUser: vi.fn() }
    const holder: GoogleSignInSession = session
    const oncomplete = vi.fn()
    const report = vi.fn()
    const run = (credential: string) =>
        signInWithGoogle({ credential, mode, api: remote, session: holder, oncomplete, report })
    return { api, session, oncomplete, report, run }
}

beforeEach(() => reauthentication.cancel())

describe('confirming identity with Google', () => {
    it('reports a refused proof, keeps the pending action, and completes once a linked account is used', async () => {
        reauthentication.request({
            description: 'link your Discord account',
            retry: async () => {}
        })
        const { api, oncomplete, report, run } = flow('reauthenticate')
        api.reauthenticateGoogle.mockRejectedValueOnce(
            new APIError({ name: 'ReauthenticationFailedError', message: REFUSED })
        )
        await run('other-account-token')
        expect(report).toHaveBeenCalledWith(REFUSED)
        expect(oncomplete).not.toHaveBeenCalled()
        expect(reauthentication.pending?.description).toBe('link your Discord account')

        await run('holder-token')
        expect(api.reauthenticateGoogle).toHaveBeenLastCalledWith('holder-token')
        expect(oncomplete).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledTimes(1)
    })
})

describe('linking a Google account', () => {
    it('asks for confirmation when linking needs Recent Authentication and links on retry', async () => {
        const { api, session, oncomplete, report, run } = flow('link')
        api.linkGoogle.mockRejectedValueOnce(
            new APIError({
                name: 'RecentAuthenticationRequiredError',
                message: 'Recent authentication is required'
            })
        )
        await run('token')
        expect(reauthentication.pending?.description).toBe(GOOGLE_LINK_DESCRIPTION)
        expect(session.setSessionUser).not.toHaveBeenCalled()
        expect(report).not.toHaveBeenCalled()

        const pending = reauthentication.pending
        assertExists(pending, 'Google linking requested confirmation')
        await reauthentication.complete(pending)
        expect(api.linkGoogle).toHaveBeenCalledTimes(2)
        expect(session.setSessionUser).toHaveBeenCalledWith(user)
        expect(oncomplete).toHaveBeenCalledTimes(1)
    })

    it('reports any other linking failure', async () => {
        const { api, oncomplete, report, run } = flow('link')
        api.linkGoogle.mockRejectedValueOnce(
            new APIError({
                name: 'AlreadyLinked',
                message: 'That Google account is already linked'
            })
        )
        await run('token')
        expect(report).toHaveBeenCalledWith('That Google account is already linked')
        expect(reauthentication.pending).toBeUndefined()
        expect(oncomplete).not.toHaveBeenCalled()
    })
})

describe('signing in with Google', () => {
    it('hands a signed-in user to the session and reports a refused login', async () => {
        const { api, session, report, run } = flow('login')
        await run('token')
        expect(session.onLogin).toHaveBeenCalledWith(user)
        api.loginGoogle.mockRejectedValueOnce(
            new APIError({ name: 'AccountUnavailable', message: 'This account is inactive' })
        )
        await run('token')
        expect(report).toHaveBeenCalledWith('This account is inactive')
        expect(session.onLogin).toHaveBeenCalledTimes(1)
    })
})
