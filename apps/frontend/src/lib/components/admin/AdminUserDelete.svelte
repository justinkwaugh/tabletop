<script lang="ts">
    import { Role, UserStatus, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { AdminSubmission } from './adminSubmission.svelte'
    import { confirmsUsername } from '$lib/utils/usernameConfirmation'

    let {
        user,
        onsaved
    }: {
        user: User
        onsaved: (user: User) => void
    } = $props()

    const { api, authorizationService } = getAppContext()

    const submission = new AdminSubmission('Could not delete the account')

    let deleted = $derived(user.status === UserStatus.Deleted)
    let unavailableReason = $derived.by(() => {
        if (user.id === authorizationService.getSessionUser()?.id)
            return 'Delete your own account from your profile.'
        if (user.roles.includes(Role.Admin)) return 'An administrator cannot be deleted.'
        return undefined
    })

    function remove() {
        const name = user.username ?? user.id
        const typed = prompt(
            `Delete ${name}? This can't be undone. Their details are removed, they are signed out, their two-player games end as concessions, and finished games show them as a deleted player. Type the username to confirm.`
        )
        if (confirmsUsername(typed, name)) submitDeletion()
    }

    function submitDeletion() {
        void submission.run(async () => onsaved(await api.deleteUser(user.id)))
    }
</script>

<section
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Delete ${user.username ?? user.id}`}
>
    {#if deleted}
        <p class="text-sm text-gray-500 dark:text-gray-400">
            This account has been deleted. If its games or notifications still show it, run the
            clean-up again.
        </p>
        <button
            type="button"
            disabled={submission.saving}
            onclick={submitDeletion}
            class="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >Run clean-up again</button
        >
    {:else if unavailableReason}
        <p class="text-sm text-gray-500 dark:text-gray-400">{unavailableReason}</p>
    {:else}
        <button
            type="button"
            disabled={submission.saving}
            onclick={remove}
            class="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
            >Delete account</button
        >
    {/if}
    {#if submission.error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">
            {submission.error}
        </p>{/if}
</section>
