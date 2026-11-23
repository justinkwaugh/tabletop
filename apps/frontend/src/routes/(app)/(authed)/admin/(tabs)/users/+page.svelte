<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import AdminUsersTab from '$lib/components/admin/AdminUsersTab.svelte'
    import { adminUsersPath, parseAdminUsersView } from '$lib/utils/adminPaths'

    const view = $derived(parseAdminUsersView(page.url.searchParams))

    function search(query: string) {
        void goto(adminUsersPath({ ...view, query }), { noScroll: true, keepFocus: true })
    }

    function selectUser(userId: string) {
        void goto(adminUsersPath({ ...view, userId }), {
            replaceState: true,
            noScroll: true,
            keepFocus: true
        })
    }
</script>

<AdminUsersTab query={view.query} userId={view.userId} onsearch={search} onselect={selectUser} />
