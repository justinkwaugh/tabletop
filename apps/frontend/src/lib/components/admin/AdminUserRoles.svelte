<script lang="ts">
    import { type AdminAssignableRole, type Role, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    let {
        user,
        assignableRoles,
        roleLabels,
        onsaved
    }: {
        user: User
        assignableRoles: readonly AdminAssignableRole[]
        roleLabels: Record<Role, string>
        onsaved: (user: User) => void
    } = $props()

    const { api } = getAppContext()

    let assigned = $derived(assignableRoles.filter((role) => user.roles.includes(role)))
    let draft = $state<AdminAssignableRole[]>([])
    let saving = $state(false)
    let error = $state('')
    let editingUserId = $state<string>()

    let selection = $derived(editingUserId === user.id ? draft : assigned)
    let changed = $derived(
        selection.length !== assigned.length || selection.some((role) => !assigned.includes(role))
    )

    function toggle(role: AdminAssignableRole, checked: boolean) {
        editingUserId = user.id
        draft = checked ? [...selection, role] : selection.filter((other) => other !== role)
    }

    async function save(event: SubmitEvent) {
        event.preventDefault()
        saving = true
        error = ''
        try {
            const updated = await api.assignUserRoles(user.id, selection)
            editingUserId = undefined
            onsaved(updated)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not update roles'
        } finally {
            saving = false
        }
    }
</script>

<form
    onsubmit={save}
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Roles for ${user.username ?? user.id}`}
>
    <h2 class="text-base font-semibold">{user.username ?? user.id}</h2>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Current roles: {user.roles.map((role) => roleLabels[role]).join(', ')}
    </p>
    <fieldset class="mt-4 flex flex-col gap-2">
        <legend class="text-sm text-gray-600 dark:text-gray-300">Assignable roles</legend>
        {#each assignableRoles as role (role)}
            <label class="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={selection.includes(role)}
                    onchange={(event) => toggle(role, event.currentTarget.checked)}
                    class="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-800"
                />
                {roleLabels[role]}
            </label>
        {/each}
    </fieldset>
    {#if error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
    <button
        type="submit"
        disabled={saving || !changed}
        class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >Save roles</button
    >
</form>
