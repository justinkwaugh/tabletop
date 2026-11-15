<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSessionView } =
        $props()
    const money = $derived(session.presentation.money)
    const debt = $derived(session.cashCrisis.debt)
    const companyName = (id: string) => session.companyName(id)
    // A failing company's choices, worded by the title (TitlePresentation.insolvency).
    const insolvency = $derived.by(() => {
        const choices = session.cashCrisis.insolvencyChoices
        if (!choices.length) return undefined
        const words = session.presentation.insolvency
        assertExists(words, 'A title offering insolvency choices words them')
        return {
            explanation: words.debtExplanation ?? words.explanation,
            choices: choices.map((choice) => {
                const entry = words.choices[choice]
                assertExists(entry, `The insolvency choice ${choice} has its words`)
                return { choice, ...entry }
            })
        }
    })
</script>

{#snippet sales()}
    {#each session.cashCrisis.sales as { sale, proceeds } (`${sale.companyId}:${sale.shares}`)}
        <button disabled={!session.cashCrisis.canSell} onclick={() => session.cashCrisis.sell(sale)}
            >Sell {sale.shares}
            {companyName(sale.companyId)}
            {sale.shares === 1 ? 'share' : 'shares'} ({money(proceeds)})</button
        >
    {/each}
{/snippet}

{#if debt && session.gameState.machineState === 'RaisingCash'}
    <section aria-label="Cash crisis">
        <h2>
            {#if debt.companyId}{session.getPlayerName(debt.playerId)} raises {money(debt.amount)}
                for {companyName(debt.companyId)}{:else}{session.getPlayerName(debt.playerId)} owes the
                bank {money(debt.amount)}{/if}
        </h2>
        {#if session.cashCrisis.insolvent}
            {#if session.cashCrisis.sales.length}
                <p>Sell shares to raise it, selling no more than it needs.</p>
                <div class="choices">
                    {@render sales()}
                </div>
            {:else if insolvency}
                <p>{insolvency.explanation}</p>
                <div class="choices insolvency-choices">
                    {#each insolvency.choices as { choice, label, description } (choice)}
                        <button
                            disabled={!session.cashCrisis.canAct}
                            data-insolvency-choice={choice}
                            onclick={() => session.cashCrisis.declareInsolvency(choice)}
                        >
                            <strong>{label}</strong>
                            <small>{description}</small>
                        </button>
                    {/each}
                </div>
            {:else}
                <p>No shares can be sold to raise it.</p>
            {/if}
        {:else if session.cashCrisis.confirming}
            <p>
                Going bankrupt gives up every share and the cash in hand, and liquidates the
                companies this player presides.
            </p>
            <div class="choices">
                <button
                    disabled={!session.cashCrisis.canAct}
                    onclick={() => session.cashCrisis.confirmBankruptcy()}
                    >Confirm bankruptcy</button
                >
                <button onclick={() => session.cashCrisis.bankruptcy.clear()}>Back</button>
            </div>
        {:else}
            <p>
                {session.cashCrisis.sales.length
                    ? 'Sell shares to pay it, selling no more than the debt needs, or go bankrupt.'
                    : 'No shares can be sold to pay it.'}
            </p>
            <div class="choices">
                {@render sales()}
                <button
                    disabled={!session.cashCrisis.canAct}
                    onclick={() => session.cashCrisis.chooseBankruptcy()}>Go bankrupt</button
                >
                {#if showUndo}<button
                        disabled={session.busy ||
                            session.updatingVisibleState ||
                            session.isViewingHistory ||
                            !session.actions.length}
                        onclick={() => session.undo()}>Undo</button
                    >{/if}
            </div>
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 12px;
        text-align: center;
    }
    h2 {
        margin: 0 0 4px;
        font-size: 13px;
    }
    p {
        margin: 0 0 8px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    button {
        padding: 7px 12px;
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .insolvency-choices button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        text-align: left;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
