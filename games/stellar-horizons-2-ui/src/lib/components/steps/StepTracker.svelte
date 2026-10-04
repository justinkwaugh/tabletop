<script lang="ts">
    import { TURN_STEPS, TurnStep } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { STEP_DONE_LABELS, STEP_LABELS } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const steps = TURN_STEPS.filter((step) => step !== TurnStep.Done)
    const current = $derived(gameSession.myStep)
    const currentIndex = $derived(current ? TURN_STEPS.indexOf(current) : -1)
</script>

<div class="tracker">
    <ol>
        {#each steps as step, index (step)}
            <li class:current={step === current} class:past={index < currentIndex}>
                {STEP_LABELS[step]}
            </li>
        {/each}
    </ol>
    {#if gameSession.canAct && current && current !== TurnStep.Done}
        <button type="button" class="done" onclick={() => gameSession.endStep()}>
            {STEP_DONE_LABELS[current]}
        </button>
    {/if}
</div>

<style>
    .tracker {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

    ol {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    li {
        font-size: 13px;
        padding: 2px 10px;
        border-radius: 999px;
        border: 1px solid #22314d;
        color: #6f84a3;
    }

    li.past {
        color: #3f5274;
        border-color: #18233a;
    }

    li.current {
        color: #05070d;
        background: #7fd3ff;
        border-color: #7fd3ff;
        font-weight: 700;
    }

    .done {
        padding: 4px 14px;
        border-radius: 8px;
        background: #f2c94c;
        color: #1d1a14;
        font-weight: 700;
    }

    .done:hover {
        background: #ffd968;
    }
</style>
