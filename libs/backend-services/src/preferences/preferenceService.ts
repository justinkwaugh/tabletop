import { createHash } from 'node:crypto'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    changePreferences,
    PreferenceError,
    PreferenceRecord,
    type PreferenceChange,
    type PreferenceResponse,
    type TitlePreferenceDefinition,
    type TitlePreferenceData
} from '@tabletop/common'
import type { RedisCacheService } from '../cache/cacheService.js'
import type { PreferenceStore } from './preferenceStore.js'

const revisionValidator = Compile(Type.Pick(PreferenceRecord, ['revision']))

type PreferenceCache = Pick<
    RedisCacheService,
    'cacheGetMulti' | 'cachingGetMulti' | 'readConsistently' | 'lockWhileWriting'
>
export class PreferenceService {
    constructor(
        private readonly store: PreferenceStore,
        private readonly cache: PreferenceCache
    ) {}

    private scopes(titleId: string, definition: TitlePreferenceDefinition) {
        return [
            `title:${titleId}`,
            ...(definition.family ? [`family:${definition.family.id}`] : [])
        ]
    }
    private keys(userId: string, scopes: readonly string[]) {
        return scopes.map((scope) => `preferences-etag:${JSON.stringify([userId, scope])}`)
    }
    private records(
        definition: TitlePreferenceDefinition,
        records: (PreferenceRecord | undefined)[]
    ) {
        return [definition.title, ...(definition.family ? [definition.family] : [])].map(
            (scope, i) => records[i] ?? { version: scope.version, revision: 0, values: {} }
        )
    }
    private etag(
        userId: string,
        scopes: readonly string[],
        revisions: readonly number[],
        definition: TitlePreferenceDefinition
    ) {
        return `"${createHash('sha256')
            .update(
                JSON.stringify([
                    userId,
                    scopes,
                    revisions,
                    definition.title.version,
                    definition.family?.version
                ])
            )
            .digest('hex')}"`
    }
    private response(
        userId: string,
        scopes: readonly string[],
        records: PreferenceRecord[],
        definition: TitlePreferenceDefinition
    ): PreferenceResponse {
        const data: TitlePreferenceData = {
            title: records[0],
            ...(records[1] ? { family: records[1] } : {})
        }
        return {
            data,
            etag: this.etag(
                userId,
                scopes,
                records.map((r) => r.revision),
                definition
            )
        }
    }

    async read(
        userId: string,
        titleId: string,
        definition: TitlePreferenceDefinition,
        ifNoneMatch?: string
    ) {
        const scopes = this.scopes(titleId, definition)
        const keys = this.keys(userId, scopes)
        const readDatabase = async () =>
            this.records(definition, await this.store.read(userId, scopes))
        const unchanged = await this.cache.readConsistently({
            keys,
            read: async () => {
                const cached = await this.cache.cacheGetMulti(keys)
                if (cached.length !== keys.length || cached.some((entry) => !entry.cached))
                    return undefined
                const tags: Pick<PreferenceRecord, 'revision'>[] = []
                for (const entry of cached) {
                    if (!revisionValidator.Check(entry.value)) return undefined
                    tags.push(entry.value)
                }
                const etag = this.etag(
                    userId,
                    scopes,
                    tags.map((tag) => tag.revision),
                    definition
                )
                return etag === ifNoneMatch ? { etag, data: undefined } : undefined
            },
            fallback: async () => undefined
        })
        if (unchanged) return unchanged
        let records: PreferenceRecord[] | undefined
        await this.cache.cachingGetMulti(keys, async (missingKeys) => {
            const loaded = await readDatabase()
            records = loaded
            return missingKeys.map((key) => {
                const record = loaded[keys.indexOf(key)]
                return { revision: record.revision }
            })
        })
        return this.response(userId, scopes, records ?? (await readDatabase()), definition)
    }

    async update(
        userId: string,
        titleId: string,
        definition: TitlePreferenceDefinition,
        change: PreferenceChange,
        ifMatch: string
    ): Promise<PreferenceResponse> {
        const scopes = this.scopes(titleId, definition)
        const index = change.scope === 'title' ? 0 : 1
        const schema = index === 0 ? definition.title : definition.family
        if (!schema) throw new PreferenceError('This title has no family preferences')
        const result = await this.cache.lockWhileWriting(this.keys(userId, scopes), async () => {
            try {
                return await this.store.update(userId, scopes, (stored) => {
                    const records = this.records(definition, stored)
                    const current = this.response(userId, scopes, records, definition)
                    if (current.etag !== ifMatch)
                        throw new PreferenceError('Preferences changed; reload and retry', 412)
                    records[index] = changePreferences(schema, records[index], change)
                    return { records, changedIndex: index }
                })
            } catch (error) {
                if (error instanceof PreferenceError) return error
                throw error
            }
        })
        if (result instanceof PreferenceError) throw result
        return this.response(userId, scopes, result, definition)
    }
}
