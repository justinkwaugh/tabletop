<script lang="ts">
    import { assert } from '@tabletop/common'
    import { tableHeaderState } from './tableHeaderState.js'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PhaseChart from '../phases/PhaseChart.svelte'
    import type { PhaseChartData } from '../phases/phaseChart.js'
    import type { CompanyNameVariants } from './companyPresentation.js'
    let {
        session,
        companyNames = {},
        bordered = true,
        centered = false,
        phaseChart,
        trainColors,
        artworkAvailable = false,
        publishedArtwork = false,
        onToggleArtwork
    }: {
        artworkAvailable?: boolean
        publishedArtwork?: boolean
        onToggleArtwork?: () => void
        bordered?: boolean
        centered?: boolean
        session: EighteenXXSession
        companyNames?: Readonly<Record<string, CompanyNameVariants>>
        phaseChart: PhaseChartData
        trainColors: Readonly<Record<string, string>>
    } = $props()
    const money = $derived(session.presentation.money)
    let showPhaseChart = $state(false)
    let compact = $state(false)
    function fitRoundLabel(header: HTMLElement) {
        const phase = header.querySelector<HTMLElement>('.phase')
        const turn = header.querySelector<HTMLElement>('.turn')
        assert(phase && turn, 'Table header requires phase and turn regions')
        const observer = new ResizeObserver(() => {
            const full = phase.querySelector<HTMLElement>('.round-full')
            const short = phase.querySelector<HTMLElement>('.round-short')
            if (!full || !short) return
            const style = getComputedStyle(header)
            const available =
                header.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight) -
                parseFloat(style.columnGap)
            const fullWidth =
                phase.getBoundingClientRect().width +
                (compact
                    ? full.getBoundingClientRect().width - short.getBoundingClientRect().width
                    : 0)
            compact =
                fullWidth + (centered ? 2 : 1) * turn.getBoundingClientRect().width > available
        })
        for (const element of [header, phase, turn]) observer.observe(element)
        return { destroy: () => observer.disconnect() }
    }
    const gameState = $derived(tableHeaderState(session))
    const auction = $derived(
        Boolean(
            (gameState.openingAuction && !gameState.openingAuction.completed) ||
            (gameState.offerAuction && !gameState.offerAuction.completed)
        )
    )
    const companyId = $derived(
        gameState.operatingSet?.companyOrder.find(
            (id) => !gameState.operatingSet?.completedCompanyIds.includes(id)
        )
    )
    const company = $derived(gameState.companies.find((company) => company.id === companyId))
</script>

{#snippet turnLabel()}
    {#if session.isViewingHistory}
        <span>History</span>
    {:else}
        {#each gameState.activePlayerIds as playerId (playerId)}
            <span class="player-name"
                ><span
                    class="player-color"
                    style:background={session.colors.getPlayerBgColorValue(playerId)}
                    aria-hidden="true"
                ></span>{session.getPlayerName(playerId)}</span
            >
        {/each}
    {/if}
{/snippet}
<header
    aria-label="Game phase"
    use:fitRoundLabel
    class:compact
    class:centered
    class:borderless={!bordered}
>
    <div class="phase">
        <strong>
            {#if gameState.result}
                Game over
            {:else if auction}
                <span class="auction-label max-sm:hidden">Opening auction</span><span
                    class="auction-label sm:hidden">Auction</span
                >
            {:else if !gameState.stockRound.completed}
                <span class="round-full" aria-hidden={compact}>Stock round</span><span
                    class="round-short"
                    aria-hidden={!compact}>SR</span
                >
                {gameState.stockRound.number}
            {:else}
                <span class="round-full" aria-hidden={compact}>Operating round</span><span
                    class="round-short"
                    aria-hidden={!compact}>OR</span
                >
                {gameState.operatingSet?.number}.{gameState.operatingSet?.roundNumber}
            {/if}
        </strong>
        <span class="separator">/</span><button
            class="phase-button"
            aria-haspopup="dialog"
            onclick={() => (showPhaseChart = true)}
            ><span class="max-sm:hidden">Phase </span><TrainBadge
                name={gameState.phaseId}
                color={trainColors[gameState.phaseId]}
            /></button
        >
        {#if company && gameState.stockRound.completed && !gameState.result}<span
                class="separator"
                aria-hidden="true">/</span
            ><span class="company" title={company.name}
                ><CompanyToken appearance={session.mapView.stations[company.id]} size={22} /><span
                    class="max-sm:hidden">{company.name}</span
                ><span class="sm:hidden">{companyNames[company.id]?.initials ?? company.id}</span
                ></span
            >{/if}
        {#if centered}<span class="separator" aria-hidden="true">/</span>{@render turnLabel()}{/if}
    </div>
    <div class="turn">
        {#if !centered}{@render turnLabel()}{/if}
        <button
            onclick={() => session.undo()}
            disabled={session.busy ||
                session.updatingVisibleState ||
                session.isViewingHistory ||
                !(session.hasLocalSelection || session.undoableAction)}>Undo</button
        >
        {#if artworkAvailable}
            <button
                class="artwork-toggle"
                aria-label={publishedArtwork ? 'Use generic presentation' : 'Use published artwork'}
                title={publishedArtwork ? 'Use generic presentation' : 'Use published artwork'}
                aria-pressed={publishedArtwork}
                onclick={onToggleArtwork}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <circle cx="8" cy="8" r="1.5"></circle>
                    <path d="m3 17 5-5 4 4 4-6 5 7"></path>
                </svg>
            </button>
        {/if}
    </div>
</header>

{#if showPhaseChart}<PhaseChart
        {money}
        depotState={{
            depot: session.trainDepot,
            inventory: gameState.trainInventory,
            availableDefinitionIds: session.availableTrainDefinitionIds
        }}
        chart={phaseChart}
        currentPhaseId={gameState.phaseId}
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
    header.borderless {
        border-bottom: 0;
    }
    header.centered {
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content minmax(max-content, 1fr);
    }
    .centered .phase {
        grid-column: 2;
    }
    .centered .turn {
        grid-column: 3;
        justify-self: end;
    }
    @media (width < 40rem) {
        header {
            min-height: 36px;
        }
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
    .artwork-toggle {
        margin-left: -8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        padding: 6px;
        color: var(--rail-muted, #786550);
    }
    .artwork-toggle[aria-pressed='true'] {
        background: var(--rail-hover, #69554016);
        color: var(--rail-text, #443c34);
    }
</style>
