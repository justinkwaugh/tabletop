<script lang="ts">
    import type { EarningsChoice } from '@tabletop/18xx'
    import EarningsCard from './EarningsCard.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSessionView } =
        $props()
    const money = $derived(session.presentation.money)
    const result = $derived(session.gameState.routeStep?.result)
    const earnings = $derived(session.earnings)
    const separateName = $derived(session.presentation.separateEarningsName ?? 'Separate revenue')
    const names: Record<EarningsChoice, string> = {
        pay: 'Pay',
        withhold: 'Withhold',
        'half-pay': 'Half-pay',
        'top-up': 'Top up and pay'
    }
</script>

{#if result && session.gameState.machineState === 'DistributingEarnings'}
    <section aria-label="Earnings distribution">
        {#if earnings.separateRevenue}
            <div class="separate" role="group" aria-label={separateName}>
                <span class="separate-name"
                    >{separateName} <b>{money(earnings.separateRevenue)}</b></span
                >
                <span class="separate-choices">
                    <button
                        aria-pressed={earnings.separateChoice === undefined}
                        disabled={!earnings.canDistribute}
                        onclick={() => earnings.decideSeparately(undefined)}>With the rest</button
                    >
                    {#each earnings.separateChoices as choice (choice)}
                        <button
                            aria-pressed={earnings.separateChoice === choice}
                            disabled={!earnings.canDistribute}
                            onclick={() => earnings.decideSeparately(choice)}
                            >{names[choice]}</button
                        >
                    {/each}
                </span>
            </div>
            {#if earnings.separateChoice}
                <p class="rest">
                    The rest, {money(result.revenue - earnings.separateRevenue)}:
                </p>
            {/if}
        {/if}
        <div class="choices">
            {#each session.earnings.choices as { choice, evaluation }, index (index)}
                {@const details = evaluation.details}
                <EarningsCard
                    {money}
                    {choice}
                    {details}
                    label={names[choice]}
                    companyId={result.companyId}
                    chart={session.stockMarketChart}
                    ownerName={(owner) => session.ownerName(owner)}
                    reason={evaluation.reason}
                    disabled={!session.earnings.canDistribute || !details}
                    onclick={() => {
                        session.earnings.select(choice)
                        void session.earnings.confirm()
                    }}
                />
            {/each}
        </div>
        {#if showUndo}<button
                class="undo"
                disabled={session.busy ||
                    session.updatingVisibleState ||
                    session.isViewingHistory ||
                    !session.actions.length}
                onclick={() => session.undo()}>Undo</button
            >{/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 12px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
        gap: 10px;
    }
    .separate {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 12px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--rail-border, #c7b8a6);
    }
    .separate-name b {
        font-variant-numeric: tabular-nums;
    }
    .separate-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .separate-choices button {
        min-height: 30px;
        padding: 3px 10px;
        border-radius: 6px;
    }
    .separate-choices button[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-raised, #efe7db);
        font-weight: 600;
    }
    .rest {
        margin: 0 0 6px;
        text-align: center;
        color: var(--rail-muted, #887664);
    }
    button {
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    .undo {
        display: block;
        margin: 10px auto 0;
        padding: 7px 12px;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
        border-color: var(--rail-border, #a68c6d);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
