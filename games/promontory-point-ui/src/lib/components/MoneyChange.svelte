<script lang="ts">
    import { moneyChipText, registerMoneyChip } from '$lib/animators/moneyChips.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()

    const chips = $derived(
        gameSession.moneyChips.chips.filter((chip) => chip.playerId === playerId)
    )
</script>

<!-- R-1.3-H1: the change rises from the seat card's money; the money animator moves it. -->
<span class="anchor" aria-hidden="true">
    {#each chips as chip (chip.id)}
        <span
            class="chip"
            class:loss={chip.change < 0}
            data-money-chip={chip.change}
            use:registerMoneyChip={{ chips: gameSession.moneyChips, id: chip.id }}
            >{moneyChipText(chip.change)}</span
        >
    {/each}
</span>

<style>
    .anchor {
        position: relative;
        display: inline-block;
        width: 0;
        height: 0;
        vertical-align: top;
    }

    .chip {
        position: absolute;
        right: 0;
        /* Just under the money, so it rises over it inside the card. */
        top: calc(22 * var(--u, 1px));
        padding: 1px 7px;
        border-radius: 999px;
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: 14px;
        line-height: 1.3;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        background: var(--pp-gain);
        color: var(--pp-ink);
        border: 2px solid var(--pp-halo);
        z-index: 2;
    }

    /* Rose costs, always labelled and on the dark halo. */
    .chip.loss {
        background: var(--pp-cost);
        color: var(--pp-cost-ink);
    }
</style>
