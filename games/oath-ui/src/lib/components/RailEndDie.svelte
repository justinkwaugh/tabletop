<script lang="ts">
    import { endDieIsRolled } from '@tabletop/oath'
    import { endDieImage } from '$lib/images/diceImages.js'
    import { lastEndDieRoll } from '$lib/model/actionLog.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-3.3's end die, live from round 5.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let endDieLive = $derived(endDieIsRolled(gameState))
    let lastEndDie = $derived(lastEndDieRoll(gameSession.actions))
</script>

{#if endDieLive || lastEndDie !== undefined}
    <section class="group" title="the end die, rolled at the close of each round from round 5">
        <h3>End die</h3>
        <div class="dice">
            {#if lastEndDie !== undefined}
                <span class="die" title="Last rolled {lastEndDie}">
                    <img src={endDieImage(lastEndDie)} alt="" />
                </span>
                <span class="dice__total">last {lastEndDie}</span>
            {:else}
                <span class="die die--unrolled die--end" title="Live — not yet rolled"></span>
                <span class="dice__total">live</span>
            {/if}
        </div>
    </section>
{/if}

<style>
    .group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    h3 {
        margin: 0;
        color: rgba(253, 230, 138, 0.72);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        max-width: 900px;
    }

    .die {
        display: block;
        width: 72px;
        height: 72px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        overflow: hidden;
        background: transparent;
        line-height: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.55);
    }

    .die img {
        display: block;
        width: 100%;
        height: 100%;
    }

    .die--unrolled {
        border: 2px dashed rgba(255, 255, 255, 0.45);
        opacity: 0.75;
    }

    .die--end {
        background: #9c66a0;
    }

    .dice__total {
        margin-left: 6px;
        font-size: 26px;
        color: #a8a29e;
        white-space: nowrap;
    }
</style>
