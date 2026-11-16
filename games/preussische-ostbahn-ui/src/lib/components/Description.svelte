<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Description } from '$lib/utils/describeAction.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadBadge from './RailroadBadge.svelte'

    let { description, short = false }: { description: Description; short?: boolean } = $props()

    const gameSession = getGameSession()
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}
        <span>{segment}</span>
    {:else if 'playerId' in segment}
        <PlayerName
            playerId={segment.playerId}
            capitalization={index > 0 && segment.playerId === gameSession.myPlayerId
                ? 'none'
                : 'capitalize'}
        />
    {:else}
        <RailroadBadge railroadId={segment.railroadId} {short} />
    {/if}
{/each}
