<script lang="ts">
    import HostedGame from '$lib/components/HostedGame.svelte'
    import TurnTabIndicator from '$lib/components/TurnTabIndicator.svelte'
    import type { PageData } from './$types'

    let { data }: { data: PageData } = $props()
</script>

{#key data.gameSession}
    <TurnTabIndicator gameId={data.game.id} gameName={data.game.name} />
    <HostedGame gameSession={data.gameSession} />
{/key}
