<script lang="ts">
    import { Role, UserStatus, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { AdminSubmission } from './adminSubmission.svelte'

    let {
        user,
        onsaved
    }: {
        user: User
        onsaved: (user: User) => void
    } = $props()

    const { api, authorizationService } = getAppContext()

    const submission = new AdminSubmission('Could not update the account')

    let banned = $derived(user.status === UserStatus.Inactive)
    let unavailableReason = $derived.by(() => {
        if (user.status === UserStatus.Deleted) return 'This account has been deleted.'
        if (user.id === authorizationService.getSessionUser()?.id)
            return 'You cannot ban your own account.'
        if (user.roles.includes(Role.Admin)) return 'An administrator cannot be banned.'
        return undefined
    })

    function applyStatusChange(change: () => Promise<User>) {
        void submission.run(async () => onsaved(await change()))
    }

    function ban() {
        const name = user.username ?? user.id
        if (
            confirm(
                `Ban ${name}? They are signed out at once. Their two-player games end as concessions, the other players in larger games are emailed, their seats in unstarted games reopen, and the unstarted games they own are deleted.`
            )
        ) {
            applyStatusChange(() => api.banUser(user.id))
        }
    }
</script>

<section
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Ban status for ${user.username ?? user.id}`}
>
    {#if banned}
        <p class="text-sm font-medium text-red-600 dark:text-red-300">This account is banned.</p>
        <button
            type="button"
            disabled={submission.saving}
            onclick={() => applyStatusChange(() => api.unbanUser(user.id))}
            class="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >Lift ban</button
        >
    {:else if unavailableReason}
        <p class="text-sm text-gray-500 dark:text-gray-400">{unavailableReason}</p>
    {:else}
        <button
            type="button"
            disabled={submission.saving}
            onclick={ban}
            class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >Ban user</button
        >
    {/if}
    {#if submission.error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">
            {submission.error}
        </p>{/if}
</section>
