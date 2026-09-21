<script lang="ts">
    import { type EarningsChoice } from '@tabletop/18xx'
    import EarningsCard from './EarningsCard.svelte'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSession } = $props()
    const result = $derived(session.financialState.routeStep?.result)
    const names: Record<EarningsChoice, string> = {
        pay: 'Pay',
        withhold: 'Withhold',
        'half-pay': 'Half-pay'
    }
</script>

{#if result && session.financialState.machineState === 'DistributingEarnings'}
    <section aria-label="Earnings distribution">
        <div class="choices">
            {#each session.earningsChoices as { choice, evaluation }}
                {@const details = evaluation.details}
                <EarningsCard {choice} {details} label={names[choice]}
                    companyId={result.companyId} stockMarket={session.financialState.stockMarket}
                    ownerName={(owner) => session.ownerName(owner)} reason={evaluation.reason}
                    disabled={!session.canDistributeEarnings || !details}
                    onclick={() => {
                        session.selectEarnings(choice)
                        void session.confirmEarnings()
                    }} />

            {/each}
        </div>
        {#if showUndo}<button class="undo"
            disabled={session.busy || session.updatingVisibleState || session.isViewingHistory || !session.actions.length}
            onclick={() => session.undo()}>Undo</button>{/if}
    </section>
{/if}

<style>
    section { padding: 4px 0; color: var(--rail-text, #514536); font-size: 12px; }
    .choices { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 10px; }
    button { font: inherit; color: inherit; cursor: pointer; background: var(--rail-surface, #fffdf8); border: 1px solid var(--rail-border, #c7b8a6); border-radius: 7px; }
    .undo { display: block; margin: 10px auto 0; padding: 7px 12px; }
    button:hover:not(:disabled) { background: var(--rail-surface-raised, #efe7db); border-color: var(--rail-border, #a68c6d); }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
    button:disabled { opacity: 0.45; cursor: default; }
</style>
