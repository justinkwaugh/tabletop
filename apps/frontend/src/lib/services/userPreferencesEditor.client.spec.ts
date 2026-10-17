import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
    const session = { user }
    const onSaved = vi.fn((saved: User) => {
        session.user = saved
    })
    const onFailed = vi.fn()
    const editor = new UserPreferencesEditor(
        user.id,
        () => session.user.preferences,
        api,
        onSaved,
        onFailed
    )
    return { editor, requests, session, onSaved, onFailed }
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

it('saves a change after a short pause', async () => {
    const { editor, requests, onSaved } = fixture()
    editor.update({ colorBlindPalette: true })
    vi.advanceTimersByTime(499)
    expect(requests).toEqual([])

    vi.advanceTimersByTime(1)
    expect(requests.map((request) => request.preferences)).toEqual([
        { ...preferences, colorBlindPalette: true }
    ])
    const saved = { ...user, preferences: requests[0].preferences }
    requests[0].result.resolve(saved)
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
})

it('combines changes made during the pause into one save', () => {
    const { editor, requests } = fixture()
    editor.update({ colorBlindPalette: true })
    vi.advanceTimersByTime(300)
    editor.update({ preferredColorsEnabled: true })
    vi.advanceTimersByTime(500)
    expect(requests.map((request) => request.preferences)).toEqual([
        { ...preferences, colorBlindPalette: true, preferredColorsEnabled: true }
    ])
})

it('sends only the latest preferences after the in-flight save completes', async () => {
    const { editor, requests } = fixture()
    editor.update({ colorBlindPalette: true })
    vi.advanceTimersByTime(500)
    editor.update({ preferredColorsEnabled: true })
    editor.update({ preventWebNotificationPrompt: true })
    vi.advanceTimersByTime(500)
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
    vi.advanceTimersByTime(500)
    requests[0].result.resolve({ ...user, preferences: requests[0].preferences })
    await vi.waitFor(() => expect(editor.values.colorBlindPalette).toBe(true))

    editor.update({ preferredColorsEnabled: true })
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    requests[1].result.reject(new Error('offline'))

    await vi.waitFor(() => expect(onFailed).toHaveBeenCalledOnce())
    expect(editor.values).toEqual({ ...preferences, colorBlindPalette: true })
})

it('keeps preferences another editor saved in the meantime', () => {
    const { editor, requests, session } = fixture()
    session.user = { ...user, preferences: { ...preferences, preferredColorsEnabled: true } }
    editor.update({ colorBlindPalette: true })
    vi.advanceTimersByTime(500)
    expect(requests[0].preferences).toEqual({
        ...preferences,
        preferredColorsEnabled: true,
        colorBlindPalette: true
    })
})
