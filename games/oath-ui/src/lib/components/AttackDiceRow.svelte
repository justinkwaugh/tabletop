<script lang="ts">
    import { range } from '@tabletop/common'
    import { attackDieBlank } from '$lib/images/diceImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let draft = $derived(gameSession.campaign)
    let maxDice = $derived(draft.maxDice)
    let pool = $derived(draft.attackDice ?? 0)
    let busy = $derived(gameSession.busy)

    function tapDie(index: number) {
        const wanted = index + 1
        draft.setAttackDice(wanted === pool ? index : wanted)
    }
</script>

{#if maxDice > 0}
    <div class="dice" title="Up to the warbands on your board. Tap a die to set the pool.">
        {#each range(0, maxDice) as index (index)}
            <button
                type="button"
                class="die"
                class:die--dim={index >= pool}
                disabled={busy}
                onclick={() => tapDie(index)}
                aria-label={index < pool
                    ? `Attack die ${index + 1}, in the pool`
                    : `Add attack die ${index + 1}`}
            >
                <img src={attackDieBlank()} alt="" />
            </button>
        {/each}
        <span class="total"
            >{draft.attackDice === undefined ? 'tap to choose' : `${pool} of ${maxDice}`}</span
        >
    </div>
{/if}

<style>
    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }
    .die {
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        overflow: hidden;
        background: transparent;
        line-height: 0;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .die img {
        display: block;
        width: 100%;
        height: 100%;
    }
    .die:hover {
        outline: 2px solid #fbbf24;
    }
    .die--dim {
        opacity: 0.28;
        filter: grayscale(0.6);
    }
    .total {
        margin-left: 6px;
        font-size: 13px;
        color: #a8a29e;
        white-space: nowrap;
    }
</style>
