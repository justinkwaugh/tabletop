import { Color, type User, type UserPreferences } from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'

const SAVE_DELAY_MS = 500

const defaultPreferences: UserPreferences = {
    preventWebNotificationPrompt: false,
    preferredColors: Object.values(Color),
    preferredColorsEnabled: false
}

export class UserPreferencesEditor {
    private pending: Partial<UserPreferences> = $state({})
    values: UserPreferences = $derived({ ...this.savedPreferences(), ...this.pending })
    private saving = false
    private unsaved = false
    private saveTimer: ReturnType<typeof setTimeout> | undefined

    constructor(
        private readonly sessionUser: () => User | undefined,
        private readonly api: Pick<TabletopApi, 'updateUserPreferences'>,
        private readonly onSaved: (user: User) => void,
        private readonly onFailed: () => void
    ) {}

    update(change: Partial<UserPreferences>) {
        Object.assign(this.pending, change)
        this.unsaved = true
        clearTimeout(this.saveTimer)
        this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY_MS)
    }

    private savedPreferences(): UserPreferences {
        return this.sessionUser()?.preferences ?? defaultPreferences
    }

    private async flush() {
        if (this.saving) return
        this.saving = true
        while (this.unsaved) {
            this.unsaved = false
            const user = this.sessionUser()
            if (!user) {
                this.pending = {}
                break
            }
            const preferences = $state.snapshot({ ...this.savedPreferences(), ...this.pending })
            try {
                this.onSaved(await this.api.updateUserPreferences(user.id, preferences))
                if (!this.unsaved) {
                    this.pending = {}
                }
            } catch (error) {
                console.error('Could not save preferences', error)
                this.unsaved = false
                this.pending = {}
                this.onFailed()
            }
        }
        this.saving = false
    }
}
