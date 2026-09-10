<script lang="ts">
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import { onMount } from 'svelte'
    import { toast } from 'svelte-sonner'

    onMount(() => {
        toast.error(page.error?.message ?? 'Unable to load the game')
        void goto('/dashboard')
    })
</script>
