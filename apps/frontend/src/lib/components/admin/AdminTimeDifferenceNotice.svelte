<script lang="ts">
    import { onMount } from 'svelte'
    import { assert, type TimeDifferenceNoticeStatus } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { AdminSubmission } from './adminSubmission.svelte'

    const { api } = getAppContext()
    const loading = new AdminSubmission('Could not load the notice status')
    const submission = new AdminSubmission('Could not queue the notice')

    let status = $state<TimeDifferenceNoticeStatus>()
    let result = $state('')

    const formatted = (date: Date) =>
        date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

    function send() {
        const startsAt = status?.startsAt
        assert(startsAt, 'The notice needs a configured start date')
        if (
            !confirm(
                `Email every active account that other players will see their time difference from ${formatted(startsAt)}? The emails go out over about two hours, and the notice can only be sent once.`
            )
        )
            return
        void submission.run(async () => {
            const outcome = await api.queueTimeDifferenceNotice()
            result =
                outcome.outcome === 'queued'
                    ? `Queued ${outcome.queued} emails.`
                    : `Already queued on ${formatted(outcome.queuedAt)}.`
            status = await api.getTimeDifferenceNotice()
        })
    }

    onMount(() => {
        void loading.run(async () => {
            status = await api.getTimeDifferenceNotice()
        })
    })
</script>

<section
    class="mt-8 rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label="Time difference notice"
>
    <h2 class="text-sm font-semibold">Time difference notice</h2>
    {#if loading.error}
        <p class="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">{loading.error}</p>
    {:else if !status}
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    {:else if !status.startsAt}
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No start date is configured, so time differences are never shown and there is nothing to
            send. Set TIME_DIFFERENCE_STARTS_AT on the backend first.
        </p>
    {:else if status.queuedAt}
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Sent on {formatted(status.queuedAt)}. Time differences show from {formatted(
                status.startsAt
            )}.
        </p>
    {:else if status.startsAt <= new Date()}
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            The start date, {formatted(status.startsAt)}, has passed without a notice, so nothing is
            shown. Set a later TIME_DIFFERENCE_STARTS_AT, then send the notice.
        </p>
    {:else}
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Time differences show from {formatted(status.startsAt)}. The notice hasn't been sent.
        </p>
        <button
            type="button"
            disabled={submission.saving}
            onclick={send}
            class="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >Send notice</button
        >
    {/if}
    {#if result}<p class="mt-2 text-sm" role="status">{result}</p>{/if}
    {#if submission.error}
        <p class="mt-2 text-sm text-red-600 dark:text-red-300" role="alert">{submission.error}</p>
    {/if}
</section>
