<script lang="ts">
    import type { User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { isAlreadyExists } from '$lib/utils/accountErrors'
    import { AdminSubmission } from './adminSubmission.svelte'

    let {
        user,
        onsaved
    }: {
        user: User
        onsaved: (user: User) => void
    } = $props()

    const { api } = getAppContext()

    let draft = $state('')
    let editingUserId = $state<string>()
    const submission = new AdminSubmission('Could not change the username', (failure) =>
        isAlreadyExists(failure) ? 'That username is already taken.' : undefined
    )

    let username = $derived(editingUserId === user.id ? draft : (user.username ?? ''))
    let changed = $derived(username.trim() !== '' && username.trim() !== user.username)

    function edit(value: string) {
        editingUserId = user.id
        draft = value
    }

    function save(event: SubmitEvent) {
        event.preventDefault()
        void submission.run(async () => {
            const updated = await api.renameUser(user.id, username)
            editingUserId = undefined
            onsaved(updated)
        })
    }
</script>

<form
    onsubmit={save}
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Username for ${user.username ?? user.id}`}
>
    <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-600 dark:text-gray-300">Username</span>
        <input
            type="text"
            name="username"
            value={username}
            oninput={(event) => edit(event.currentTarget.value)}
            autocomplete="off"
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
    </label>
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Also replaces the name in all of their games, and emails them the new sign-in name.
    </p>
    {#if submission.error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">
            {submission.error}
        </p>{/if}
    <button
        type="submit"
        disabled={submission.saving || !changed}
        class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >Save username</button
    >
</form>
