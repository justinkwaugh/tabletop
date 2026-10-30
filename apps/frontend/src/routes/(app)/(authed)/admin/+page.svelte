<script lang="ts">
    import { Button, P } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { nextTabIndex } from '$lib/utils/tabNavigation'
    import AdminUsersTab from '$lib/components/admin/AdminUsersTab.svelte'
    import AdminGamesTab from '$lib/components/admin/AdminGamesTab.svelte'
    import AdminStatsTab from '$lib/components/admin/AdminStatsTab.svelte'

    const { authorizationService } = getAppContext()
    let entering = $state(false)

    async function enterAdminMode() {
        entering = true
        try {
            await authorizationService.requestAdminMode()
        } catch (error) {
            console.error('Could not enter Admin Mode', error)
            toast.error('Could not enter Admin Mode')
        } finally {
            entering = false
        }
    }

    type AdminTab = 'users' | 'games' | 'stats'
    const tabs: { id: AdminTab; label: string }[] = [
        { id: 'users', label: 'Users' },
        { id: 'games', label: 'Games' },
        { id: 'stats', label: 'Stats' }
    ]
    let tab = $state<AdminTab>('users')

    function moveTab(event: KeyboardEvent, index: number) {
        const next = nextTabIndex(event.key, index, tabs.length)
        if (next === undefined) return
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
        {#if !authorizationService.actAsAdmin}
            <div class="flex flex-col items-start gap-3">
                <P class="text-gray-700 dark:text-gray-300"
                    >Administration needs Admin Mode, which lasts fifteen minutes from your latest
                    sign-in confirmation.</P
                >
                <Button color="primary" disabled={entering} onclick={enterAdminMode}
                    >Enter Admin Mode</Button
                >
            </div>
        {:else if tab === 'users'}
            <AdminUsersTab />
        {:else if tab === 'games'}
            <AdminGamesTab />
        {:else}
            <AdminStatsTab />
        {/if}
    </div>
</main>
