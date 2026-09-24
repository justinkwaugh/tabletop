import { untrack } from 'svelte'

export class DebouncedLayout {
    ready = $state(false)
    value: unknown = $state.raw(null)
    status: '' | 'unsaved' | 'saving' | 'saved' | 'error' = $state('')
    private key: string | undefined
    private baseline: unknown
    private epoch = 0
    private revision = 0
    private timer: ReturnType<typeof setTimeout> | undefined
    private dirty = false
    private saving = false
    private disposed = false

    constructor(snapshot: () => { ready: boolean; key: string | undefined; value: unknown }, private persist: (value: unknown) => Promise<boolean>) {
        $effect(() => {
            const current = snapshot()
            if (!current.ready) {
                untrack(() => {
                    clearTimeout(this.timer)
                    this.epoch++
                    this.key = undefined
                    this.dirty = false
                    this.saving = false
                    this.ready = false
                    this.status = ''
                })
                return
            }
            untrack(() => {
                if (current.key !== this.key) {
                    clearTimeout(this.timer)
                    this.epoch++
                    this.revision++
                    this.dirty = false
                    this.saving = false
                    this.status = ''
                    this.key = current.key
                    this.baseline = current.value
                    this.value = current.value
                    this.recover()
                } else if (!this.dirty && !this.saving) {
                    this.baseline = current.value
                    this.value = current.value
                }
                this.ready = true
            })
        })
        $effect(() => () => { this.disposed = true; clearTimeout(this.timer) })
    }

    change = (value: unknown) => {
        if (JSON.stringify(value) === JSON.stringify(this.value)) return
        this.value = value
        this.revision++
        this.dirty = true
        this.status = 'unsaved'
        this.backup()
        this.schedule()
    }

    private schedule() {
        clearTimeout(this.timer)
        this.timer = setTimeout(() => { void this.save() }, 3000)
    }

    private backup() {
        if (!this.key) return
        try { localStorage.setItem(this.key, JSON.stringify({ base: this.baseline, value: this.value })) } catch { /* Storage can be disabled by the browser. */ }
    }

    private recover() {
        if (!this.key) return
        try {
            const raw = localStorage.getItem(this.key)
            if (!raw) return
            const draft: unknown = JSON.parse(raw)
            if (draft && typeof draft === 'object' && 'base' in draft && 'value' in draft && JSON.stringify(draft.base) === JSON.stringify(this.baseline)) {
                this.value = draft.value
                this.dirty = true
                this.status = 'unsaved'
                this.schedule()
            } else localStorage.removeItem(this.key)
        } catch { /* Ignore corrupt or unavailable recovery storage. */ }
    }

    save = async () => {
        clearTimeout(this.timer)
        if (!this.dirty || this.saving || this.disposed) return
        const epoch = this.epoch
        const revision = this.revision
        const key = this.key
        const value = this.value
        this.saving = true
        this.status = 'saving'
        let saved = false
        try { saved = await this.persist(value) } catch { saved = false }
        if (this.disposed || epoch !== this.epoch || key !== this.key) return
        this.saving = false
        if (saved) this.baseline = value
        if (revision !== this.revision) {
            this.backup()
            this.status = 'unsaved'
            this.schedule()
            return
        }
        if (!saved) { this.status = 'error'; return }
        this.dirty = false
        this.status = 'saved'
        if (key) { try { localStorage.removeItem(key) } catch { /* Optional recovery storage. */ } }
        this.timer = setTimeout(() => { this.status = '' }, 2500)
    }
}
