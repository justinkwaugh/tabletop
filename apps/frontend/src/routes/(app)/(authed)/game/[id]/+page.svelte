<script lang="ts">
    import HostedGame from '$lib/components/HostedGame.svelte'
    import type { PageData } from './$types'

    let { data }: { data: PageData } = $props()
</script>

{#key data.gameSession}
    <HostedGame gameSession={data.gameSession} />
{/key}
