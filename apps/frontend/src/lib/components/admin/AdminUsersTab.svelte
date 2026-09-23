<script lang="ts">
    import { ADMIN_ASSIGNABLE_ROLES, Role, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import AdminUserRoles from './AdminUserRoles.svelte'

    const { api } = getAppContext()
    const roleLabels: Record<Role, string> = {
        [Role.User]: 'User',
        [Role.Admin]: 'Admin',
        [Role.Developer]: 'Developer',
        [Role.BetaTester]: 'Beta tester',
        [Role.AlphaTester]: 'Alpha tester'
    }

    let query = $state('')
    let users = $state<User[]>([])
    let selected = $state<User>()
    let busy = $state(false)
    let searched = $state(false)
    let error = $state('')
    let request = 0

    async function search(event: SubmitEvent) {
        event.preventDefault()
        const current = ++request
        busy = true
        error = ''
        try {
            const results = await api.searchUsers(query)
            if (current !== request) return
            users = results
            searched = true
            selected = results.find((user) => user.id === selected?.id)
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not search users'
        } finally {
            if (current === request) busy = false
        }
    }

    function replaceUser(updated: User) {
        users = users.map((user) => (user.id === updated.id ? updated : user))
        selected = updated
    }
</script>

<form class="flex flex-wrap items-end gap-3" onsubmit={search}>
    <label class="flex grow flex-col gap-1 text-sm sm:max-w-md">
        <span class="text-gray-600 dark:text-gray-300">Username or email</span>
        <input
            type="search"
            name="query"
            bind:value={query}
            autocomplete="off"
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
    </label>
    <button
        type="submit"
        disabled={busy || !query.trim()}
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >Search</button
    >
</form>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div aria-busy={busy}>
        {#if searched && !users.length && !busy}
            <p class="text-sm text-gray-500 dark:text-gray-400">No users match that search.</p>
        {/if}
        {#if users.length}
            <ul
                class="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700/60 dark:border-gray-700/60"
            >
                {#each users as user (user.id)}
                    <li>
                        <button
                            type="button"
                            aria-pressed={selected?.id === user.id}
                            onclick={() => (selected = user)}
                            class="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 aria-pressed:bg-blue-50 dark:hover:bg-gray-800/60 dark:aria-pressed:bg-blue-900/30"
                        >
                            <span class="font-medium">{user.username ?? user.id}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                                {user.email ?? 'No email'} · {user.status} ·
                                {user.roles.map((role) => roleLabels[role]).join(', ')}
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
    {#if selected}
        <AdminUserRoles
            user={selected}
            assignableRoles={ADMIN_ASSIGNABLE_ROLES}
            {roleLabels}
            onsaved={replaceUser}
        />
    {/if}
</div>
