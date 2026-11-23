<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import AdminGamesTab from '$lib/components/admin/AdminGamesTab.svelte'
    import { adminGamesPath, parseAdminGamesTitle } from '$lib/utils/adminPaths'

    const titleId = $derived(parseAdminGamesTitle(page.url.searchParams))

    function selectTitle(next: string) {
        void goto(adminGamesPath(next), { noScroll: true, keepFocus: true })
    }
</script>

<AdminGamesTab {titleId} onselect={selectTitle} />
