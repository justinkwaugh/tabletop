<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Description } from '$lib/utils/describeAction.js'
    import RailroadBadge from './RailroadBadge.svelte'

    let { description }: { description: Description } = $props()

    const gameSession = getGameSession()
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}<span>{segment}</span
        >{:else if 'playerId' in segment}<PlayerName
            playerId={segment.playerId}
            capitalization={index > 0 && segment.playerId === gameSession.myPlayerId
                ? 'none'
                : 'capitalize'}
        />{:else}<RailroadBadge railroadId={segment.railroadId} />{/if}
{/each}
