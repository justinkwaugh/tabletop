<script lang="ts">
    import { isIgnorableRunStop } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import HelpPopover from '../table/HelpPopover.svelte'
    import StopNotice from '../table/StopNotice.svelte'
    import RunStopChoices from './RunStopChoices.svelte'
    import { ignorableRunStops, runStopText } from './runInstructionText.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const runs = $derived(session.runInstructions)
    const disabled = $derived(session.busy || !runs.canChange)
</script>

{#if runs.shown}
    <div class="row" role="group" aria-label="Autorun">
        <div class="pill">
            <span class="pill-label" class:on={runs.anyOn}>Autorun</span>
            {#each runs.presided as companyId (companyId)}
                {@const name = session.companyName(companyId)}
                {@const on = runs.isOn(companyId)}
                <button
                    class="token"
                    {disabled}
                    aria-pressed={on}
                    aria-label={`Autorun ${name}`}
                    title={on
                        ? `Stop autorunning ${name}`
                        : `Run ${name}’s best routes and pay out on its turns, building and buying nothing`}
                    onclick={() => (on ? runs.cancel(companyId) : runs.declare(companyId))}
                >
                    <CompanyToken appearance={session.mapView.stations[companyId]} size={16} />
                </button>
            {/each}
        </div>
        <HelpPopover label="When Autorun stops">
            <RunStopChoices {session} {disabled} />
        </HelpPopover>
        {#if runs.failure}
            <span class="warning" role="alert">{runs.failure.message}</span>
        {/if}
        {#each runs.stopped as { companyId, stopReason } (companyId)}
            {#if stopReason}
                <span class="notice" role="status"
                    ><StopNotice
                        subject={session.companyName(companyId)}
                        reason={runStopText[stopReason]}
                        keepGoing={isIgnorableRunStop(stopReason)
                            ? {
                                  ignoring: ignorableRunStops[stopReason].noun,
                                  resume: () => void runs.keepGoing(companyId)
                              }
                            : undefined}
                        {disabled}
                    /></span
                >
            {/if}
        {/each}
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-height: 26px;
    }
    .pill {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px;
        border-radius: 999px;
        background: var(--rail-surface-inset, #1b232d);
    }
    .pill-label {
        padding: 3px 6px 3px 10px;
        line-height: 16px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--rail-muted, #7f8e9e);
    }
    .pill-label.on {
        color: var(--rail-text, #e3e9ef);
    }
    .notice {
        color: var(--rail-muted, #7f8e9e);
    }
    .warning {
        color: var(--rail-negative, #d0655c);
    }
    .token {
        padding: 1px;
        border: 2px solid transparent;
        border-radius: 999px;
        background: transparent;
        line-height: 0;
        opacity: 0.4;
        cursor: pointer;
    }
    .token:disabled {
        cursor: default;
    }
    .token:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .token[aria-pressed='true'] {
        border-color: var(--rail-positive-hover, #35916a);
        opacity: 1;
    }
    .token:hover:not(:disabled) {
        opacity: 1;
    }
</style>
