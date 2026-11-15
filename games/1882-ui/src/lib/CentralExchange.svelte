<script lang="ts">
    import { marketSpaceColor, marketZone } from '@tabletop/18xx-ui'
    import type { Session1882 } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    let { session }: { session: Session1882 } = $props()
    const money = $derived(session.presentation.money)
</script>

<TitlePanel label="Exchange the Saskatchewan Central">
    <p>
        Exchange the Saskatchewan Central for the SCR president’s certificate, as this turn’s
        purchase: set its par and pay for one share.
    </p>
    <div class="choices" aria-label="Par prices">
        {#each session.centralParSpaces as spaceId (spaceId)}
            {@const space = session.stockMarketChart.space(spaceId)}
            {@const zone = marketZone(session.presentation.marketZones, space.color)}
            <button
                class="par-choice"
                class:chosen={session.centralPar === spaceId}
                disabled={session.busy}
                style:background={marketSpaceColor(space.color, zone)}
                aria-pressed={session.centralPar === spaceId}
                data-par-price={space.price}
                onclick={() => session.chooseCentralPar(spaceId)}>{money(space.price)}</button
            >
        {/each}
    </div>
    {#if session.centralPar}
        <p>
            Choose the SCR’s home on the map: any open city, or a neutral station, which leaves the
            game.
        </p>
    {/if}
</TitlePanel>

<style>
    .par-choice {
        min-width: 52px;
        padding: 6px 10px;
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
        color: #2c2418;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
    }
    .par-choice.chosen {
        outline: 2px solid var(--rail-text, #514536);
        outline-offset: 1px;
    }
    .par-choice:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
