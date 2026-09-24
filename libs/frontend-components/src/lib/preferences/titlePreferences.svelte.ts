import type * as Type from 'typebox'
import { untrack } from 'svelte'
import {
    changePreferences,
    resolvePreferences,
    type PreferenceChange,
    type PreferenceResponse,
    type TitlePreferenceData,
    type TitlePreferenceDefinition
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'

export class TitlePreferences<T extends Type.TObject> {
    private response: PreferenceResponse | undefined = $state.raw()
    private pending: PreferenceChange[] = $state.raw([])
    private userId: string | undefined
    private completions = new Map<PreferenceChange, (saved: boolean) => void>()
    private generation = 0
    private loadSequence = 0
    private processing = false
    private loading: Promise<void> = Promise.resolve()
    private readonly cleanup: () => void
    private channel: BroadcastChannel | undefined
    error: string | undefined = $state()
    ready = $state(false)
    values = $derived.by(() => {
        let data = this.response?.data ?? this.empty()
        for (const change of this.pending) data = this.apply(data, change)
        return resolvePreferences(this.definition, data)
    })

    constructor(
        private readonly definition: TitlePreferenceDefinition<T>,
        private readonly titleId: string,
        private readonly api: RemoteApiService,
        private readonly getUserId: () => string | undefined,
        private readonly onError: (message: string) => void
    ) {
        this.cleanup = $effect.root(() => {
            const accountId = $derived(this.getUserId())
            $effect(() => {
                const userId = accountId
                untrack(() => {
                    this.userId = userId
                    this.generation++
                    this.response = undefined
                    this.ready = false
                    for (const complete of this.completions.values()) complete(false)
                    this.completions.clear()
                    this.pending = []
                    this.error = undefined
                    this.processing = false
                    this.loading = this.reload()
                })
            })
        })
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', this.refresh)
            this.channel = new BroadcastChannel('tabletop-preferences')
            this.channel.onmessage = this.refresh
        }
    }

    set(values: Partial<Type.Static<T>>, scope: 'title' | 'family' = 'title') {
        this.change(scope, values, [])
    }

    storageKey(scope: 'title' | 'family') {
        const id = scope === 'family' ? this.definition.family?.id : this.titleId
        return this.userId && id ? `tabletop:layout:${this.userId}:${scope}:${id}` : undefined
    }

    save(values: Partial<Type.Static<T>>, scope: 'title' | 'family' = 'title'): Promise<boolean> {
        return this.change(scope, values, [])
    }

    unset(keys: (keyof Type.Static<T> & string)[], scope: 'title' | 'family' = 'title') {
        this.change(scope, {}, keys)
    }

    private change(scope: 'title' | 'family', set: Partial<Type.Static<T>>, unset: string[]) {
        const definition = scope === 'title' ? this.definition.title : this.definition.family
        if (!definition) throw new Error('This title has no family preferences')
        const change: PreferenceChange = { scope, version: definition.version, set, unset }
        const data = this.apply(this.response?.data ?? this.empty(), change)
        if (!this.userId || !this.api.getTitlePreferences || !this.api.updateTitlePreferences) {
            this.response = { data, etag: '' }
            return Promise.resolve(false)
        }
        const completion = new Promise<boolean>(resolve => this.completions.set(change, resolve))
        this.pending = [...this.pending, change]
        void this.flush()
        return completion
    }

    private empty(): TitlePreferenceData {
        return {
            title: { version: this.definition.title.version, revision: 0, values: {} },
            ...(this.definition.family
                ? {
                      family: { version: this.definition.family.version, revision: 0, values: {} }
                  }
                : {})
        }
    }

    private apply(data: TitlePreferenceData, change: PreferenceChange): TitlePreferenceData {
        const definition = change.scope === 'title' ? this.definition.title : this.definition.family
        const record = data[change.scope]
        if (!definition || !record) throw new Error('Preference scope is unavailable')
        return { ...data, [change.scope]: changePreferences(definition, record, change) }
    }

    private isCurrent(generation: number) {
        return generation === this.generation && this.userId === this.getUserId()
    }

    private async load() {
        const generation = this.generation
        const sequence = ++this.loadSequence
        try {
            if (!this.userId || !this.api.getTitlePreferences) return
            const response = await this.api.getTitlePreferences(this.titleId, this.userId)
            resolvePreferences(this.definition, response.data)
            if (this.isCurrent(generation) && sequence === this.loadSequence) this.response = response
        } finally {
            if (this.isCurrent(generation) && sequence === this.loadSequence) this.ready = true
        }
    }

    private async reload() {
        const generation = this.generation
        try {
            await this.load()
        } catch (error) {
            if (this.isCurrent(generation)) this.report(error)
        }
    }

    private refresh = () => {
        if (this.processing || this.pending.length) return
        this.loading = this.reload()
    }

    private async flush() {
        if (this.processing) return
        if (!this.api.updateTitlePreferences || !this.api.getTitlePreferences || !this.userId)
            return
        this.processing = true
        const generation = this.generation
        try {
            await this.loading
            while (this.isCurrent(generation) && this.pending.length) {
                const change = this.pending[0]
                let saved = false
                try {
                    if (!this.response) await this.load()
                    if (!this.isCurrent(generation)) return
                    if (!this.response || !this.userId)
                        throw new Error('Preferences could not be loaded')
                    let result: PreferenceResponse
                    try {
                        result = await this.api.updateTitlePreferences(
                            this.titleId,
                            this.userId,
                            change,
                            this.response.etag
                        )
                    } catch (error) {
                        if (
                            typeof error !== 'object' ||
                            error === null ||
                            !('status' in error) ||
                            error.status !== 412
                        )
                            throw error
                        await this.load()
                        if (!this.isCurrent(generation)) return
                        result = await this.api.updateTitlePreferences(
                            this.titleId,
                            this.userId,
                            change,
                            this.response.etag
                        )
                    }
                    resolvePreferences(this.definition, result.data)
                    if (!this.isCurrent(generation)) return
                    this.loadSequence++
                    this.response = result
                    this.error = undefined
                    this.channel?.postMessage('changed')
                    saved = true
                } catch (error) {
                    if (!this.isCurrent(generation)) return
                    this.report(error)
                }
                this.completions.get(change)?.(saved)
                this.completions.delete(change)
                this.pending = this.pending.slice(1)
            }
        } finally {
            if (this.isCurrent(generation)) this.processing = false
        }
    }

    private report(error: unknown) {
        this.error = error instanceof Error ? error.message : 'Unable to save preferences'
        this.onError(this.error)
    }

    dispose() {
        this.cleanup()
        if (typeof window !== 'undefined') window.removeEventListener('focus', this.refresh)
        this.channel?.close()
        this.channel = undefined
    }
}
