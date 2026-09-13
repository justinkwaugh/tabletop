import * as Type from 'typebox'
import { flushSync } from 'svelte'
import { type PreferenceChange, type PreferenceResponse } from '@tabletop/common'
import { DummyRemoteApiService } from '../../harness/dummyRemoteApiService.js'
import { TitlePreferences } from '../titlePreferences.svelte.js'

const schema = Type.Object({ compact: Type.Boolean(), sound: Type.Boolean() })
const definition = { title: { schema, defaults: { compact: false, sound: true }, version: 1 } }
function response(values: Record<string, unknown>, revision = 0): PreferenceResponse {
    return { data: { title: { version: 1, revision, values } }, etag: String(revision) }
}

export async function verifyQueuedPreferences() {
    class Api extends DummyRemoteApiService {
        stored = response({})
        writes: PreferenceChange[] = []
        getTitlePreferences = async () => this.stored
        updateTitlePreferences = async (
            _title: string,
            _user: string,
            change: PreferenceChange,
            etag: string
        ) => {
            this.writes.push(change)
            if (this.writes.length === 1) {
                this.stored = response({ sound: false }, 1)
                throw Object.assign(new Error('Conflict'), { status: 412 })
            }
            if (etag !== this.stored.etag) throw new Error('Stale tag')
            this.stored = response(
                { ...this.stored.data.title.values, ...change.set },
                Number(etag) + 1
            )
            return this.stored
        }
    }
    const api = new Api()
    const errors: string[] = []
    const preferences = new TitlePreferences(
        definition,
        'title',
        api,
        () => 'alice',
        (error) => errors.push(error)
    )
    flushSync()
    preferences.set({ compact: true })
    preferences.set({ compact: false })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const result = {
        values: preferences.values,
        stored: api.stored.data.title.values,
        writes: api.writes.length,
        errors
    }
    preferences.dispose()
    return result
}

export async function verifyPreferenceAccountChange() {
    let user = $state('alice')
    let finish: ((response: PreferenceResponse) => void) | undefined
    class Api extends DummyRemoteApiService {
        getTitlePreferences = async (_title: string, userId: string) =>
            userId === 'alice'
                ? new Promise<PreferenceResponse>((resolve) => {
                      finish = resolve
                  })
                : response({ compact: false })
    }
    const preferences = new TitlePreferences(
        definition,
        'title',
        new Api(),
        () => user,
        () => {}
    )
    flushSync()
    user = 'bob'
    flushSync()
    await Promise.resolve()
    finish?.(response({ compact: true }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const values = preferences.values
    preferences.dispose()
    return values
}

export async function verifyFailedPreferenceWrite() {
    class Api extends DummyRemoteApiService {
        getTitlePreferences = async () => response({})
        updateTitlePreferences = async () => {
            throw new Error('Save failed')
        }
    }
    const errors: string[] = []
    const preferences = new TitlePreferences(
        definition,
        'title',
        new Api(),
        () => 'alice',
        (error) => errors.push(error)
    )
    flushSync()
    preferences.set({ compact: true })
    const optimistic = preferences.values.compact
    await new Promise((resolve) => setTimeout(resolve, 10))
    const result = { optimistic, saved: preferences.values.compact, errors }
    preferences.dispose()
    return result
}

export async function verifyOlderHostPreferences() {
    const preferences = new TitlePreferences(
        definition,
        'title',
        new DummyRemoteApiService(),
        () => 'alice',
        () => {}
    )
    flushSync()
    preferences.set({ compact: true })
    const values = preferences.values
    preferences.dispose()
    return values
}

export async function verifySaveAfterDisposal() {
    let finish: ((response: PreferenceResponse) => void) | undefined
    class Api extends DummyRemoteApiService {
        saved = false
        getTitlePreferences = async () =>
            new Promise<PreferenceResponse>((resolve) => {
                finish = resolve
            })
        updateTitlePreferences = async () => {
            this.saved = true
            return response({ compact: true }, 1)
        }
    }
    const api = new Api()
    const preferences = new TitlePreferences(
        definition,
        'title',
        api,
        () => 'alice',
        () => {}
    )
    flushSync()
    preferences.set({ compact: true })
    preferences.dispose()
    finish?.(response({}))
    await new Promise((resolve) => setTimeout(resolve, 10))
    return api.saved
}
