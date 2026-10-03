import { Color, type User, type UserPreferences } from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'

const defaultPreferences: UserPreferences = {
    preventWebNotificationPrompt: false,
    preferredColors: Object.values(Color),
    preferredColorsEnabled: false
}

export class UserPreferencesEditor {
    values: UserPreferences
    private saved: UserPreferences
    private saving = false
    private unsaved = false

    constructor(
        private readonly user: User,
        private readonly api: Pick<TabletopApi, 'updateUserPreferences'>,
        private readonly onSaved: (user: User) => void,
        private readonly onFailed: () => void
    ) {
        this.saved = $state.snapshot(user.preferences ?? defaultPreferences)
        this.values = $state(structuredClone(this.saved))
    }

    update(change: Partial<UserPreferences>) {
        Object.assign(this.values, change)
        this.save()
    }

    save() {
        this.unsaved = true
        void this.flush()
    }

    private async flush() {
        if (this.saving) return
        this.saving = true
        while (this.unsaved) {
            this.unsaved = false
            const preferences = $state.snapshot(this.values)
            try {
                const user = await this.api.updateUserPreferences(this.user.id, preferences)
                this.saved = preferences
                this.onSaved(user)
            } catch (error) {
                console.error('Could not save preferences', error)
                this.unsaved = false
                this.values = structuredClone(this.saved)
                this.onFailed()
            }
        }
        this.saving = false
    }
}
