import type { UserPreferences } from '@tabletop/common'

export function reminderPreferences(reminders: Partial<UserPreferences>): UserPreferences {
    return {
        preventWebNotificationPrompt: false,
        preferredColorsEnabled: false,
        preferredColors: [],
        ...reminders
    }
}
