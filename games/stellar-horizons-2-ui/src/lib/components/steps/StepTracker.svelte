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
    <ol aria-label="Steps of your turn">
        {#each steps as step, index (step)}
            <li
                class:current={step === current}
                class:past={index < currentIndex}
                aria-current={step === current ? 'step' : undefined}
                title={STEP_LABELS[step]}
            >
                <span class="number">{index + 1}</span>
                <span class="label">{STEP_LABELS[step]}</span>
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
        container-type: inline-size;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px 12px;
        flex-wrap: wrap;
    }

    /* One track of arrow segments, each pointing into the next. */
    ol {
        --point: 9px;
        display: flex;
        min-width: 0;
    }

    li {
        margin-left: calc(3px - var(--point));
        padding: 4px 14px 4px calc(var(--point) + 10px);
        font-size: 13px;
        white-space: nowrap;
        color: #7f93b3;
        background: #131d31;
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%,
            var(--point) 50%
        );
    }

    li:first-child {
        margin-left: 0;
        padding-left: 12px;
        clip-path: polygon(
            0 0,
            calc(100% - var(--point)) 0,
            100% 50%,
            calc(100% - var(--point)) 100%,
            0 100%
        );
    }

    li.past {
        color: #86a6c9;
        background: #1c3553;
    }

    li.current {
        color: #05070d;
        background: #7fd3ff;
        font-weight: 700;
    }

    .number {
        display: none;
    }

    /* Collapse to numbers by the panel's own width, since the sidebar narrows it. */
    @container (max-width: 620px) {
        li:not(.current) .label {
            display: none;
        }

        li:not(.current) .number {
            display: inline;
        }
    }

    .done {
        margin-left: auto;
        white-space: nowrap;
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
