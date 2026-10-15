<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Description } from '$lib/utils/describeAction.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CompanyBadge from './CompanyBadge.svelte'
    import IndustryToken from './IndustryToken.svelte'

    let { description }: { description: Description } = $props()

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
    {:else if 'amount' in segment}
        <span class="amount">{gameSession.money(segment.amount)}</span>
    {:else if 'companyId' in segment}
        <CompanyBadge companyId={segment.companyId} />
    {:else}
        <IndustryToken industry={segment.industry} size={16} labelled />
    {/if}
{/each}
