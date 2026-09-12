<script lang="ts">
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const state = $derived(session.financialState)
    const auction = $derived(
        Boolean(
            (session.auction && !session.auction.auction.completed) ||
            (session.offerAuction && !session.offerAuction.auction.completed)
        )
    )
    const companyId = $derived(
        state.operatingSet?.companyOrder.find(
            (id) => !state.operatingSet?.completedCompanyIds.includes(id)
        )
    )
    const company = $derived(state.companies.find((company) => company.id === companyId))
</script>

<header aria-label="Game phase">
    <div class="phase">
        <strong
            >{state.result
                ? 'Game over'
                : auction
                  ? 'Opening auction'
                  : !state.stockRound.completed
                    ? `Stock round ${state.stockRound.number}`
                    : `Operating round ${state.operatingSet?.number}.${state.operatingSet?.roundNumber}`}</strong
        >
        <span class="separator">/</span><span>Phase {state.phaseId}</span>
        {#if company && state.stockRound.completed && !state.result}<span class="company"
                >{company.name}</span
            >{/if}
    </div>
    <div class="turn">
        <span
            >{session.isViewingHistory
                ? 'History'
                : state.activePlayerIds.map((id) => session.getPlayerName(id)).join(' · ')}</span
        >
        <button
            onclick={() => session.undo()}
            disabled={session.busy ||
                session.updatingVisibleState ||
                session.isViewingHistory ||
                !(session.hasActionDraft || session.undoableAction)}>Undo</button
        >
    </div>
</header>

<style>
    header {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 16px;
        color: #5e4937;
    }
    .phase,
    .turn {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    strong {
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    span {
        font-size: 12px;
    }
    .separator {
        color: #b9a997;
    }
    .company {
        color: #817261;
    }
    button {
        padding: 7px 8px;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
    }
    button:hover:enabled {
        background: #ffffff66;
    }
    button:disabled {
        opacity: 0.3;
        cursor: default;
    }
</style>
