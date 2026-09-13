import { Compile } from 'typebox/compile'
import {
    changePreferences,
    PreferenceRecord,
    PreferenceError,
    type PreferenceChange,
    type PreferenceResponse,
    type TitlePreferenceDefinition
} from '@tabletop/common'
import { DummyRemoteApiService } from './dummyRemoteApiService.js'

export class HarnessPreferenceApi extends DummyRemoteApiService {
    constructor(
        private readonly titleId: string,
        private readonly definition?: TitlePreferenceDefinition
    ) {
        super()
    }

    getTitlePreferences = async (titleId: string, userId: string): Promise<PreferenceResponse> => {
        const definition = this.getDefinition(titleId)
        const title = this.read(userId, `title:${titleId}`, definition.title.version)
        const family = definition.family
            ? this.read(userId, `family:${definition.family.id}`, definition.family.version)
            : undefined
        return {
            data: { title, ...(family ? { family } : {}) },
            etag: JSON.stringify([userId, titleId, title.revision, family?.revision])
        }
    }

    updateTitlePreferences = async (
        titleId: string,
        userId: string,
        change: PreferenceChange,
        etag: string
    ): Promise<PreferenceResponse> => {
        return navigator.locks.request('tabletop-harness-preferences', async () => {
            const current = await this.getTitlePreferences(titleId, userId)
            if (etag !== current.etag) throw new PreferenceError('Preferences changed', 412)
            const definition = this.getDefinition(titleId)
            const scope = change.scope === 'title' ? definition.title : definition.family
            const record = current.data[change.scope]
            if (!scope || !record) throw new PreferenceError('Preference scope is unavailable')
            const key =
                change.scope === 'title' ? `title:${titleId}` : `family:${definition.family?.id}`
            localStorage.setItem(
                this.key(userId, key),
                JSON.stringify(changePreferences(scope, record, change))
            )
            return this.getTitlePreferences(titleId, userId)
        })
    }

    private getDefinition(titleId: string) {
        if (titleId !== this.titleId || !this.definition)
            throw new PreferenceError('Title preferences are unavailable', 404)
        return this.definition
    }
    private key(userId: string, scope: string) {
        return `tabletop:harness:preferences:${JSON.stringify([userId, scope])}`
    }
    private read(userId: string, scope: string, version: number): PreferenceRecord {
        const stored = localStorage.getItem(this.key(userId, scope))
        if (!stored) return { version, revision: 0, values: {} }
        const record: unknown = JSON.parse(stored)
        if (!Compile(PreferenceRecord).Check(record)) throw new Error('Invalid saved preferences')
        return record
    }
}
