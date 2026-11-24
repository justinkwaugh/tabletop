<script lang="ts">
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
        { key: 'afterOneHour', label: 'After 1 hour' },
        { key: 'afterFiveHours', label: 'After 5 hours' },
        { key: 'afterThirteenHours', label: 'After 13 hours' }
    ]

    const repeatOptions: { value: TurnReminderRepeat; label: string }[] = [
        { value: 'twiceDaily', label: 'Twice a day' },
        { value: 'daily', label: 'Once a day' },
        { value: 'none', label: 'No more' }
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
        Choose which reminders you get while it's your turn. Reminders stop as soon as you take your
        turn.
    </p>
    <div class="flex items-center justify-between gap-3">
        <div class="flex flex-col">
            <span class="text-sm font-medium text-gray-900 dark:text-white"
                >When your turn begins</span
            >
            <span class="text-xs text-gray-600 dark:text-gray-400"
                >About a minute after it becomes your turn</span
            >
        </div>
        <span class="shrink-0 text-xs text-gray-600 dark:text-gray-400">Always sent</span>
    </div>
    {#each followUps as followUp (followUp.key)}
        <Toggle
            checked={choices[followUp.key]}
            onchange={(event) => setFollowUp(followUp.key, event.currentTarget.checked)}
            >{followUp.label}</Toggle
        >
    {/each}
    <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-gray-900 dark:text-white">Then, for up to a week</span
        >
        <SegmentedControl
            name="turn-reminder-repeat"
            ariaLabel="Repeat reminders"
            options={repeatOptions}
            bind:value={() => choices.repeat, (repeat) => save({ repeat })}
        />
    </div>
    <p class="text-xs text-gray-600 dark:text-gray-400">
        Reminder Hours below still apply: reminders from 5 hours on wait for your next selected
        hour.
    </p>
</div>
