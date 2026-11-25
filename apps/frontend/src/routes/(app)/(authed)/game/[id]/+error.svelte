<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import { onMount } from 'svelte'
    import { toast } from 'svelte-sonner'
    import { m } from '$lib/paraglide/messages'

    onMount(() => {
        toast.error(page.error?.message ?? m.games_page_load_failed())
        void goto('/dashboard')
    })
</script>
