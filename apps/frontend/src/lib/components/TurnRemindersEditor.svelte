<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { Toggle } from 'flowbite-svelte'
    import {
        turnReminderChoices,
        type TurnReminderChoices,
        type TurnReminderFollowUp,
        type TurnReminderRepeat
    } from '@tabletop/common'
    import { SegmentedControl } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { userPreferencesEditor: editor } = getAppContext()

    const choices = $derived(turnReminderChoices(editor.values))

    const followUps: { key: TurnReminderFollowUp; label: string }[] = [
        { key: 'afterOneHour', label: m.turn_reminders_after_hours({ hours: 1 }) },
        { key: 'afterFiveHours', label: m.turn_reminders_after_hours({ hours: 5 }) },
        { key: 'afterThirteenHours', label: m.turn_reminders_after_hours({ hours: 13 }) }
    ]

    const repeatOptions: { value: TurnReminderRepeat; label: string }[] = [
        { value: 'twiceDaily', label: m.turn_reminders_twice_daily() },
        { value: 'daily', label: m.turn_reminders_daily() },
        { value: 'none', label: m.turn_reminders_no_more() }
    ]

    function save(change: Partial<TurnReminderChoices>) {
        editor.update({ turnReminders: { ...choices, ...change } })
    }

    function setFollowUp(key: TurnReminderFollowUp, on: boolean) {
        const change: Partial<TurnReminderChoices> = {}
        change[key] = on
        save(change)
    }
</script>

<div class="flex flex-col gap-3">
    <p class="text-sm text-gray-700 dark:text-gray-300">
        {m.turn_reminders_intro()}
    </p>
    <div class="flex items-center justify-between gap-3">
        <div class="flex flex-col">
            <span class="text-sm font-medium text-gray-900 dark:text-white"
                >{m.turn_reminders_turn_begins()}</span
            >
            <span class="text-xs text-gray-600 dark:text-gray-400"
                >{m.turn_reminders_turn_begins_detail()}</span
            >
        </div>
        <span class="shrink-0 text-xs text-gray-600 dark:text-gray-400"
            >{m.turn_reminders_always_sent()}</span
        >
    </div>
    {#each followUps as followUp (followUp.key)}
        <Toggle
            checked={choices[followUp.key]}
            onchange={(event) => setFollowUp(followUp.key, event.currentTarget.checked)}
            >{followUp.label}</Toggle
        >
    {/each}
    <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-gray-900 dark:text-white"
            >{m.turn_reminders_then()}</span
        >
        <SegmentedControl
            name="turn-reminder-repeat"
            ariaLabel={m.turn_reminders_repeat_label()}
            options={repeatOptions}
            bind:value={() => choices.repeat, (repeat) => save({ repeat })}
        />
    </div>
    <p class="text-xs text-gray-600 dark:text-gray-400">
        {m.turn_reminders_hours_apply()}
    </p>
</div>
