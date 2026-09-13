<script lang="ts">
    import { untrack } from 'svelte'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    let {
        session,
        phaseChart,
        trainColors
    }: {
        session: FinanceExampleSession
        phaseChart: PhaseChartData
        trainColors: Readonly<Record<string, string>>
    } = $props()
    let showPhaseChart = $state(false)
    let compact = $state(false)
    let headerElement: HTMLElement
    let phaseElement: HTMLDivElement
    let turnElement: HTMLDivElement
    let fullLabel = $state<HTMLSpanElement>()
    let shortLabel = $state<HTMLSpanElement>()
    $effect(() => {
        const full = fullLabel
        const short = shortLabel
        if (!full || !short) return
        const observer = new ResizeObserver(() => {
            const style = getComputedStyle(headerElement)
            const available = headerElement.clientWidth - parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight) - parseFloat(style.columnGap)
            const fullWidth = phaseElement.getBoundingClientRect().width +
                (untrack(() => compact) ? full.getBoundingClientRect().width -
                    short.getBoundingClientRect().width : 0)
            compact = fullWidth + turnElement.getBoundingClientRect().width > available
        })
        for (const element of [headerElement, phaseElement, turnElement, full, short]) {
            observer.observe(element)
        }
        return () => observer.disconnect()
    })
    const financialState = $derived(session.financialState)
    const auction = $derived(
        Boolean(
            (session.auction && !session.auction.auction.completed) ||
            (session.offerAuction && !session.offerAuction.auction.completed)
        )
    )
    const companyId = $derived(
        financialState.operatingSet?.companyOrder.find(
            (id) => !financialState.operatingSet?.completedCompanyIds.includes(id)
        )
    )
    const company = $derived(financialState.companies.find((company) => company.id === companyId))
</script>

<header aria-label="Game phase" bind:this={headerElement} class:compact>
    <div class="phase" bind:this={phaseElement}>
        <strong>
            {#if financialState.result}
                Game over
            {:else if auction}
                Opening auction
            {:else if !financialState.stockRound.completed}
                <span class="round-full" bind:this={fullLabel} aria-hidden={compact}>Stock round</span><span class="round-short" bind:this={shortLabel} aria-hidden={!compact}>SR</span>
                {financialState.stockRound.number}
            {:else}
                <span class="round-full" bind:this={fullLabel} aria-hidden={compact}>Operating round</span><span class="round-short" bind:this={shortLabel} aria-hidden={!compact}>OR</span>
                {financialState.operatingSet?.number}.{financialState.operatingSet?.roundNumber}
            {/if}
        </strong>
        <span class="separator">/</span><button
            class="phase-button"
            aria-haspopup="dialog"
            onclick={() => (showPhaseChart = true)}>Phase <TrainBadge name={financialState.phaseId} color={trainColors[financialState.phaseId]} /></button
        >
        {#if company && financialState.stockRound.completed && !financialState.result}<span class="separator" aria-hidden="true">/</span><span
                class="company"
                ><CompanyToken
                    appearance={session.mapView.stations[company.id]}
                    size={22}
                />{company.name}</span
            >{/if}
    </div>
    <div class="turn" bind:this={turnElement}>
        <span
            >{session.isViewingHistory
                ? 'History'
                : financialState.activePlayerIds
                      .map((id) => session.getPlayerName(id))
                      .join(' · ')}</span
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

{#if showPhaseChart}<PhaseChart
        chart={phaseChart}
        currentPhaseId={financialState.phaseId}
        {trainColors}
        onclose={() => (showPhaseChart = false)}
    />{/if}

<style>
    header {
        min-height: 44px;
        flex-shrink: 0;
        box-sizing: border-box;
        border-bottom: 1px solid #b8a995;
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
        flex-shrink: 0;
        white-space: nowrap;
    }
    strong,
    .company {
        font-size: 13px;
        font-weight: 650;
    }
    strong {
        white-space: nowrap;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    span {
        font-size: 12px;
    }
    .round-full,
    .round-short {
        font: inherit;
    }
    .round-short,
    .compact .round-full {
        position: absolute;
        visibility: hidden;
        width: max-content;
    }
    .compact .round-short {
        position: static;
        visibility: visible;
    }
    .separator {
        color: #b9a997;
    }
    .company {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: inherit;
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
    .phase-button {
        padding: 4px 5px;
        margin: 0 -5px;
        border-radius: 4px;
        text-transform: none;
        letter-spacing: normal;
    }
    button:focus-visible {
        outline: 2px solid #9e7752;
        outline-offset: 2px;
    }
    button:hover:enabled {
        background: #ffffff66;
    }
    button:disabled {
        opacity: 0.3;
        cursor: default;
    }
</style>
