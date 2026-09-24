<script lang="ts">
    import AdminUsersTab from '$lib/components/admin/AdminUsersTab.svelte'
    import AdminGamesTab from '$lib/components/admin/AdminGamesTab.svelte'

    type AdminTab = 'users' | 'games'
    const tabs: { id: AdminTab; label: string }[] = [
        { id: 'users', label: 'Users' },
        { id: 'games', label: 'Games' }
    ]
    let tab = $state<AdminTab>('users')

    function moveTab(event: KeyboardEvent, index: number) {
        let next: number
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = tabs.length - 1
        else return
        event.preventDefault()
        tab = tabs[next].id
        document.getElementById(`admin-tab-${tab}`)?.focus()
    }
</script>

<svelte:head><title>Admin · Tabletop</title></svelte:head>
<main class="collection-page pb-10 text-gray-900 dark:text-gray-100">
    <header class="collection-header">
        <h1 class="collection-heading">Admin</h1>
    </header>
    <div class="border-b border-gray-200 dark:border-gray-700/60">
        <div role="tablist" aria-label="Admin" class="collection-tabs">
            {#each tabs as candidate, index (candidate.id)}
                <button
                    role="tab"
                    id={`admin-tab-${candidate.id}`}
                    aria-selected={tab === candidate.id}
                    aria-controls="admin-panel"
                    tabindex={tab === candidate.id ? 0 : -1}
                    onclick={() => (tab = candidate.id)}
                    onkeydown={(event) => moveTab(event, index)}
                    class="collection-tab {tab === candidate.id
                        ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}"
                    >{candidate.label}</button
                >
            {/each}
        </div>
    </div>
    <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} class="pt-5">
        {#if tab === 'users'}
            <AdminUsersTab />
        {:else}
            <AdminGamesTab />
        {/if}
    </div>
</main>
