<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PHASE_DONE_LABELS, PHASE_LABELS } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const phases = $derived(gameSession.gameState.scenarioDefinition().phases)
    const current = $derived(gameSession.currentPhase)
    const currentIndex = $derived(current ? phases.indexOf(current) : -1)
    const acting = $derived(gameSession.actingPhase)
    const order = $derived(gameSession.phaseOrder)
</script>

<div class="tracker">
    <ol class="phases" aria-label="Phases of the decade">
        {#each phases as phase, index (phase)}
            <li
                class:current={phase === current}
                class:past={index < currentIndex}
                aria-current={phase === current ? 'step' : undefined}
                title={PHASE_LABELS[phase]}
            >
                <span class="number">{index + 1}</span>
                <span class="label">{PHASE_LABELS[phase]}</span>
            </li>
        {/each}
    </ol>
    {#if acting}
        <button type="button" class="done" onclick={() => gameSession.endPhase()}>
            {PHASE_DONE_LABELS[acting]}
        </button>
    {/if}
    {#if order.length > 1}
        <ol class="order" aria-label="Order of play this phase">
            {#each order as entry (entry.playerId)}
                <li
                    data-progress={entry.progress}
                    class:you={entry.playerId === gameSession.myPlayerId}
                    title={entry.progress === 'done'
                        ? 'Finished'
                        : entry.progress === 'playing'
                          ? 'Playing'
                          : 'Not started'}
                >
                    <PlayerName playerId={entry.playerId} />
                    {#if entry.progress === 'done'}
                        <span class="mark" aria-label="finished">✓</span>
                    {/if}
                </li>
            {/each}
        </ol>
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
    .phases {
        --point: 9px;
        display: flex;
        min-width: 0;
    }

    .phases li {
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

    .phases li:first-child {
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

    .phases li.past {
        color: #86a6c9;
        background: #1c3553;
    }

    .phases li.current {
        color: #05070d;
        background: #7fd3ff;
        font-weight: 700;
    }

    .number {
        display: none;
    }

    /* Collapse to numbers by the panel's own width, since the sidebar narrows it. */
    @container (max-width: 620px) {
        .phases li:not(.current) .label {
            display: none;
        }

        .phases li:not(.current) .number {
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

    /* The players of the phase in the order their play lands, each marked off once finished. */
    .order {
        display: flex;
        flex-basis: 100%;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 0;
        font-size: 12px;
        color: #7f93b3;
    }

    .order li {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
    }

    .order li + li::before {
        content: '›';
        margin-right: 10px;
        margin-left: -14px;
        color: #3d4a63;
    }

    .order li[data-progress='playing'] {
        color: #dbe7f5;
        border-color: #2a5878;
    }

    .order li[data-progress='done'] {
        color: #6f84a3;
    }

    .order li.you {
        background: #131d31;
    }

    .mark {
        color: #7fe08a;
        font-weight: 700;
    }
</style>
