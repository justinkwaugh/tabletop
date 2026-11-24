<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import { assertExists } from '@tabletop/common'
    import { nextTabIndex } from '$lib/utils/tabNavigation'
    import { adminTabOf, adminTabPath, type AdminTab } from '$lib/utils/adminPaths'

    let { children } = $props()

    const tabs: { id: AdminTab; label: string }[] = [
        { id: 'users', label: 'Users' },
        { id: 'games', label: 'Games' },
        { id: 'stats', label: 'Stats' }
    ]
    const tab = $derived.by(() => {
        const current = adminTabOf(page.url.pathname)
        assertExists(current, `No admin tab at ${page.url.pathname}`)
        return current
    })

    function selectTab(next: AdminTab, replaceState = false) {
        if (next === tab) return
        void goto(adminTabPath(next), { replaceState, noScroll: true, keepFocus: true })
    }

    function moveTab(event: KeyboardEvent, index: number) {
        const next = nextTabIndex(event.key, index, tabs.length)
        if (next === undefined) return
        event.preventDefault()
        selectTab(tabs[next].id, true)
        document.getElementById(`admin-tab-${tabs[next].id}`)?.focus()
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
                    onclick={() => selectTab(candidate.id)}
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
        {@render children()}
    </div>
</main>
