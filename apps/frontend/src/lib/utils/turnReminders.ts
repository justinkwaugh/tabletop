import type { TurnReminderFollowUp, TurnReminderRepeat } from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

export function turnReminderFollowUpOptions(): { key: TurnReminderFollowUp; label: string }[] {
    return [
        { key: 'afterOneHour', label: m.turn_reminders_after_hours({ hours: 1 }) },
        { key: 'afterFiveHours', label: m.turn_reminders_after_hours({ hours: 5 }) },
        { key: 'afterThirteenHours', label: m.turn_reminders_after_hours({ hours: 13 }) }
    ]
}

export function turnReminderRepeatOptions(): { value: TurnReminderRepeat; label: string }[] {
    return [
        { value: 'twiceDaily', label: m.turn_reminders_twice_daily() },
        { value: 'daily', label: m.turn_reminders_daily() },
        { value: 'none', label: m.turn_reminders_no_more() }
    ]
}
