import { expect, it, vi } from 'vitest'
import { Color, Role, UserStatus, type User, type UserPreferences } from '@tabletop/common'
import { UserPreferencesEditor } from './userPreferencesEditor.svelte.js'

const preferences: UserPreferences = {
    preventWebNotificationPrompt: false,
    preferredColorsEnabled: false,
    preferredColors: [Color.Red, Color.Blue]
}
const user: User = {
    id: 'user',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: [],
    preferences
}

function fixture() {
    const requests: { preferences: UserPreferences; result: PromiseWithResolvers<User> }[] = []
    const api = {
        updateUserPreferences: vi.fn((_userId: string, preferences: UserPreferences) => {
            const result = Promise.withResolvers<User>()
            requests.push({ preferences, result })
            return result.promise
        })
    }
    const onSaved = vi.fn()
    const onFailed = vi.fn()
    const editor = new UserPreferencesEditor(user, api, onSaved, onFailed)
    return { editor, requests, onSaved, onFailed }
}

it('saves each change immediately', async () => {
    const { editor, requests, onSaved } = fixture()
    editor.update({ colorBlindPalette: true })
    expect(requests.map((request) => request.preferences)).toEqual([
        { ...preferences, colorBlindPalette: true }
    ])
    const saved = { ...user, preferences: requests[0].preferences }
    requests[0].result.resolve(saved)
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
})

it('sends only the latest preferences after the in-flight save completes', async () => {
    const { editor, requests } = fixture()
    editor.update({ colorBlindPalette: true })
    editor.update({ preferredColorsEnabled: true })
    editor.update({ preventWebNotificationPrompt: true })
    expect(requests).toHaveLength(1)

    requests[0].result.resolve(user)
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1].preferences).toEqual({
        preventWebNotificationPrompt: true,
        preferredColorsEnabled: true,
        preferredColors: [Color.Red, Color.Blue],
        colorBlindPalette: true
    })
})

it('reverts to the last saved preferences and reports a failed save', async () => {
    const { editor, requests, onFailed } = fixture()
    editor.update({ colorBlindPalette: true })
    requests[0].result.resolve(user)
    await vi.waitFor(() => expect(editor.values.colorBlindPalette).toBe(true))

    editor.update({ preferredColorsEnabled: true })
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    requests[1].result.reject(new Error('offline'))

    await vi.waitFor(() => expect(onFailed).toHaveBeenCalledOnce())
    expect(editor.values).toEqual({ ...preferences, colorBlindPalette: true })
})
