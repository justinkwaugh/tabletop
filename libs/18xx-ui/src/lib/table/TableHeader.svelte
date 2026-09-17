<script lang="ts">
    import { untrack } from 'svelte'
    import { FinanceExampleValidator } from '@tabletop/18xx'
    import { assert } from '@tabletop/common'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    let {
        session,
        companyNames = {},
        bordered = true,
        phaseChart,
        trainColors
    }: {
        bordered?: boolean
        session: FinanceExampleSession
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
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
    const financialState = $derived.by(() => {
        if (!session.isViewingHistory && session.isMyTurn) return session.financialState
        const state = session.history.visibleContext.state
        assert(FinanceExampleValidator.Check(state), 'Round header requires financial state')
        return state
    })
    const auction = $derived(
        Boolean(
            (financialState.openingAuction && !financialState.openingAuction.completed) ||
            (financialState.offerAuction && !financialState.offerAuction.completed)
        )
    )
    const companyId = $derived(
        financialState.operatingSet?.companyOrder.find(
            (id) => !financialState.operatingSet?.completedCompanyIds.includes(id)
        )
    )
    const company = $derived(financialState.companies.find((company) => company.id === companyId))
</script>

<header aria-label="Game phase" bind:this={headerElement} class:compact class:borderless={!bordered}>
    <div class="phase" bind:this={phaseElement}>
        <strong>
            {#if financialState.result}
                Game over
            {:else if auction}
                <span class="auction-label max-sm:hidden">Opening auction</span><span class="auction-label sm:hidden">Auction</span>
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
            onclick={() => (showPhaseChart = true)}><span class="max-sm:hidden">Phase </span><TrainBadge name={financialState.phaseId} color={trainColors[financialState.phaseId]} /></button
        >
        {#if company && financialState.stockRound.completed && !financialState.result}<span class="separator" aria-hidden="true">/</span><span
                class="company" title={company.name}
                ><CompanyToken
                    appearance={session.mapView.stations[company.id]}
                    size={22}
                /><span class="max-sm:hidden">{company.name}</span><span class="sm:hidden">{companyNames[company.id]?.initials ?? company.id}</span></span
            >{/if}
    </div>
    <div class="turn" bind:this={turnElement}>
        {#if session.isViewingHistory}
            <span>History</span>
        {:else}
            {#each financialState.activePlayerIds as playerId (playerId)}
                <span class="player-name"><span
                    class="player-color"
                    style:background={session.colors.getPlayerBgColorValue(playerId)}
                    aria-hidden="true"
                ></span>{session.getPlayerName(playerId)}</span>
            {/each}
        {/if}
        <button
            onclick={() => session.undo()}
            disabled={session.busy ||
                session.updatingVisibleState ||
                session.isViewingHistory ||
                !(session.hasActionDraft || session.undoableAction)}>Undo</button
        >
            <button class="theme-toggle"
                aria-label={session.preferences.values.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={session.preferences.values.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onclick={() => session.preferences.set({ theme: session.preferences.values.theme === 'dark' ? 'light' : 'dark' }, 'family')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    {#if session.preferences.values.theme === 'dark'}
                        <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                    {:else}
                        <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />
                    {/if}
                </svg>
            </button>
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
        border-bottom: 1px solid var(--rail-border, #b8a995);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0;
        color: var(--rail-text, #5e4937);
    }
    header.borderless { border-bottom: 0; }
    @media (width < 40rem) {
        header { min-height: 36px; }
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
    .company,
    .player-name {
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
    .round-short,
    .auction-label {
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
        color: var(--rail-muted, #b9a997);
    }
    .company,
    .player-name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: inherit;
    }
    .company > span {
        font: inherit;
    }
    .player-color {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        border-radius: 50%;
    }
    button {
        padding: 7px 8px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
    }
    .phase-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 5px;
        margin: 0 -5px;
        border-radius: 4px;
        text-transform: none;
        letter-spacing: normal;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
    button:hover:enabled {
        background: var(--rail-hover, #ffffff66);
    }
    button:disabled {
        opacity: 0.3;
        cursor: default;
    }
    .theme-toggle { margin-left: -8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; padding: 6px; border: 0; border-radius: 5px; background: transparent; color: var(--rail-muted, #786550); cursor: pointer; }
    .theme-toggle:hover { background: var(--rail-hover, #69554016); color: var(--rail-text, #443c34); }
    .theme-toggle:focus-visible { outline: 2px solid var(--rail-focus, #796047); outline-offset: 1px; }
</style>
