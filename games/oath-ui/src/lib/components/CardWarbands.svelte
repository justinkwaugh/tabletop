<script lang="ts">
    import { plural } from '$lib/model/names.js'
    import { warbandImage } from '$lib/images/pieceImages.js'
    import { warbandsOnCardOf } from '$lib/model/cardWarbands.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { cardId, size = 16 }: { cardId: string; size?: number } = $props()

    let gameSession = getGameSession()
    let counts = $derived(warbandsOnCardOf(gameSession.gameState, cardId))
</script>

{#if counts.length > 0}
    <span class="card-warbands" style:--size="{size}px">
        {#each counts as { color, count } (color)}
            <span class="chip" title="{plural(count, `${color} warband`)} on this card">
                <img src={warbandImage(color)} alt="" />
                <span class="count">{count}</span>
            </span>
        {/each}
    </span>
{/if}

<style>
    .card-warbands {
        display: inline-flex;
        gap: 4px;
        padding: 1px 4px;
        border-radius: 999px;
        background: rgba(12, 10, 9, 0.85);
        line-height: 1;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 1px;
    }

    .chip img {
        height: var(--size);
        width: auto;
    }

    .count {
        color: #fff;
        font-weight: 800;
        font-size: calc(var(--size) * 0.75);
    }
</style>
