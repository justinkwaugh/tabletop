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
    private saving: Promise<boolean> | undefined
    private unsaved = false
    private saveTimer: ReturnType<typeof setTimeout> | undefined

    constructor(
        private readonly sessionUser: () => User | undefined,
        private readonly api: Pick<TabletopApi, 'updateUserPreferences'>,
        private readonly onSaved: (user: User) => void,
        private readonly onFailed: () => void
    ) {}

    update(change: Partial<UserPreferences>) {
        this.stage(change)
        this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY_MS)
    }

    updateNow(change: Partial<UserPreferences>): Promise<boolean> {
        this.stage(change)
        return this.flush()
    }

    private stage(change: Partial<UserPreferences>) {
        Object.assign(this.pending, change)
        this.unsaved = true
        clearTimeout(this.saveTimer)
    }

    private savedPreferences(): UserPreferences {
        return this.sessionUser()?.preferences ?? defaultPreferences
    }

    private flush(): Promise<boolean> {
        this.saving ??= this.saveUntilCurrent().finally(() => {
            this.saving = undefined
        })
        return this.saving
    }

    private async saveUntilCurrent(): Promise<boolean> {
        while (this.unsaved) {
            this.unsaved = false
            const user = this.sessionUser()
            if (!user) {
                this.pending = {}
                return false
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
                return false
            }
        }
        return true
    }
}
