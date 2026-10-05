<script lang="ts">
    import { getShop } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import type { OutcomeReport } from '$lib/utils/moneyReport.js'

    let { outcomes }: { outcomes: OutcomeReport[] } = $props()
    const gameSession = getGameSession()
</script>

{#each outcomes as outcome, index (index)}
    <span class="font-normal">
        {#if outcome.kind === 'auction'}
            {@const color = getShop(outcome.result.shopId).color}
            <PlayerTag playerId={outcome.result.winnerId} /> won the
            <span class="font-semibold" style:color={gameSession.marketPalettes[color].stroke}
                >{color} shop</span
            >.
        {:else}
            <PlayerTag playerId={outcome.collectorId} /> completed their antique set.
        {/if}
    </span>{' '}
{/each}
