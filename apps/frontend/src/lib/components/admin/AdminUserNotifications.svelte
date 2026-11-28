<script lang="ts">
    import {
        canHoldAuthenticatedSession,
        receivesGameEmail,
        turnReminderChoices,
        type AdminTopicRegistrations,
        type User
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import { reminderHoursForm, reminderHoursSummary } from '$lib/utils/reminderHours'
    import {
        turnReminderFollowUpOptions,
        turnReminderRepeatOptions
    } from '$lib/utils/turnReminders'

    let { user }: { user: User } = $props()

    const { api } = getAppContext()
    const requests = new LatestRequest()

    type Channels =
        | { kind: 'loading' }
        | { kind: 'loaded'; registrations: AdminTopicRegistrations }
        | { kind: 'failed'; message: string }

    let channels = $state<Channels>({ kind: 'loading' })

    const reminders = $derived(turnReminderChoices(user.preferences))
    const followUps = $derived(
        turnReminderFollowUpOptions()
            .filter(({ key }) => reminders[key])
            .map(({ label }) => label)
    )
    const repeat = $derived(
        turnReminderRepeatOptions().find(({ value }) => value === reminders.repeat)?.label
    )
    const gameEmailBlocker = $derived(
        !user.email
            ? 'no email address'
            : canHoldAuthenticatedSession(user)
              ? undefined
              : 'account cannot sign in'
    )
    const hours = $derived(reminderHoursForm(user.preferences?.reminderHours))

    $effect(() => {
        void load(user.id)
    })

    async function load(userId: string) {
        const current = requests.begin()
        channels = { kind: 'loading' }
        try {
            const registrations = await api.getUserNotificationsAsAdministrator(userId)
            if (current()) channels = { kind: 'loaded', registrations }
        } catch (failure) {
            if (current())
                channels = {
                    kind: 'failed',
                    message:
                        failure instanceof Error ? failure.message : 'Could not load notifications'
                }
        }
    }
</script>

{#snippet state(on: boolean, detail?: string)}
    <span
        class={on
            ? 'font-medium text-green-700 dark:text-green-400'
            : 'text-gray-500 dark:text-gray-400'}>{on ? 'On' : 'Off'}</span
    >
    {#if detail}<span class="text-gray-600 dark:text-gray-300">{detail}</span>{/if}
{/snippet}

<section
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Notifications for ${user.username ?? user.id}`}
>
    <h3 class="text-sm font-medium">Notifications</h3>
    {#if channels.kind === 'failed'}
        <p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{channels.message}</p>
    {/if}
    <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {#if channels.kind === 'loaded'}
            {@const { webPushBrowsers, discordBot, discordWebhook, telegram } =
                channels.registrations}
            <dt class="text-gray-600 dark:text-gray-300">Browser push</dt>
            <dd class="flex flex-wrap gap-x-2">
                {@render state(webPushBrowsers.length > 0, webPushBrowsers.join(', '))}
            </dd>
            <dt class="text-gray-600 dark:text-gray-300">Discord DM</dt>
            <dd class="flex flex-wrap gap-x-2">{@render state(discordBot)}</dd>
            <dt class="text-gray-600 dark:text-gray-300">Discord webhook</dt>
            <dd class="flex flex-wrap gap-x-2">
                {@render state(!!discordWebhook, discordWebhook?.name)}
            </dd>
            <dt class="text-gray-600 dark:text-gray-300">Telegram</dt>
            <dd class="flex flex-wrap gap-x-2">{@render state(telegram)}</dd>
        {:else if channels.kind === 'loading'}
            <dt class="text-gray-600 dark:text-gray-300">Channels</dt>
            <dd class="text-gray-500 dark:text-gray-400">Loading…</dd>
        {/if}
        <dt class="text-gray-600 dark:text-gray-300">Game emails</dt>
        <dd class="flex flex-wrap gap-x-2">
            {@render state(receivesGameEmail(user), gameEmailBlocker)}
        </dd>
        <dt class="text-gray-600 dark:text-gray-300">Turn reminders</dt>
        <dd>
            {followUps.length ? followUps.join(', ') : 'No follow-ups'} · Repeat: {repeat}
        </dd>
        <dt class="text-gray-600 dark:text-gray-300">Reminder hours</dt>
        <dd>
            {#if hours.separateWeekend}
                weekdays {reminderHoursSummary(hours.weekday)} · weekends {reminderHoursSummary(
                    hours.weekend
                )}
            {:else}
                {reminderHoursSummary(hours.weekday)}
            {/if}
            {#if user.timeZone}<span class="text-gray-500 dark:text-gray-400">
                    ({user.timeZone})</span
                >{/if}
        </dd>
    </dl>
</section>
