<script lang="ts">
    import { Toggle } from 'flowbite-svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        reminderHoursForm,
        reminderHoursFromForm,
        reminderHoursSummary,
        type ReminderHoursForm
    } from '$lib/utils/reminderHours'
    import ReminderHourGrid from './ReminderHourGrid.svelte'
    import TimeZonePicker from './TimeZonePicker.svelte'

    type HoursGroup = 'weekday' | 'weekend'

    const { userPreferencesEditor: editor } = getAppContext()

    const shown = $derived(reminderHoursForm(editor.values.reminderHours))
    let weekendRequested = $state(false)
    let hiddenWeekend: number[] | undefined = $state(undefined)
    const separateWeekend = $derived(weekendRequested || shown.separateWeekend)

    const groups: { key: HoursGroup; name: string }[] = $derived(
        separateWeekend
            ? [
                  { key: 'weekday', name: 'Weekdays' },
                  { key: 'weekend', name: 'Weekends' }
              ]
            : [{ key: 'weekday', name: 'Every day' }]
    )

    function save(form: ReminderHoursForm) {
        editor.update({ reminderHours: reminderHoursFromForm(form) })
    }

    function setHours(group: HoursGroup, hours: number[]) {
        save({ ...shown, separateWeekend, [group]: hours })
    }

    function showWeekend() {
        weekendRequested = true
        save({
            weekday: shown.weekday,
            weekend: hiddenWeekend ?? shown.weekday,
            separateWeekend: true
        })
    }

    function hideWeekend() {
        hiddenWeekend = shown.weekend
        weekendRequested = false
        save({ ...shown, separateWeekend: false })
    }
</script>

<div class="flex flex-col gap-4">
    <div class="text-sm text-gray-700 dark:text-gray-300">
        Pick the hours you'd like turn reminders. Tap or drag across hours to toggle them. Reminders
        in the first hour of your turn come right away; later ones wait for your next selected hour.
        With no hours selected, reminders come at any time.
    </div>
    {#each groups as group (group.key)}
        <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{group.name}</span>
                <span class="text-right text-xs text-gray-600 dark:text-gray-400"
                    >{reminderHoursSummary(shown[group.key])}</span
                >
            </div>
            <ReminderHourGrid
                label={`${group.name} reminder hours`}
                hours={shown[group.key]}
                onchange={(hours) => setHours(group.key, hours)}
            />
        </div>
    {/each}
    <Toggle
        checked={separateWeekend}
        onchange={(event) => (event.currentTarget.checked ? showWeekend() : hideWeekend())}
        >Different hours on weekends</Toggle
    >
    <TimeZonePicker />
    <div class="text-xs text-gray-600 dark:text-gray-400">Weekends are Saturday and Sunday.</div>
</div>
