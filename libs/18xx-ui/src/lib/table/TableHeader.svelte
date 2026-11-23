<script lang="ts">
    import { assert } from '@tabletop/common'
    import { actingOperatingCompany } from '@tabletop/18xx'
    import { currentRoundHeading } from './roundHeading.js'
    import { isHistoryBookkeeping } from './historyNavigation.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import RestartTurnConfirm from './RestartTurnConfirm.svelte'
    import DisplaySettings from './DisplaySettings.svelte'
    import { PhoneLayoutQuery } from './displayChoices.js'
    import { MediaQuery } from 'svelte/reactivity'
    let {
        session,
        bordered = true,
        centered = false,
        attention = false
    }: {
        bordered?: boolean
        centered?: boolean
        attention?: boolean
        session: EighteenXXSessionView
    } = $props()
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
    const gameState = $derived(session.gameState)
    const titleRounds = $derived(session.presentation.titleRounds)
    const opening = $derived(
        session.presentation.openingRound?.inProgress(gameState)
            ? session.presentation.openingRound
            : undefined
    )
    const auction = $derived(
        Boolean(
            (gameState.openingAuction && !gameState.openingAuction.completed) ||
            (gameState.offerAuction && !gameState.offerAuction.completed) ||
            (gameState.selectionAuction && !gameState.selectionAuction.completed)
        )
    )
    const companyId = $derived(
        actingOperatingCompany(gameState) ??
            gameState.operatingSet?.companyOrder.find(
                (id) => !gameState.operatingSet?.completedCompanyIds.includes(id)
            )
    )
    const company = $derived(gameState.companies.find((company) => company.id === companyId))
    const restart = $derived(session.turnRestart)
    const headerId = $props.id()
    const restartId = `${headerId}-restart`
    let restartButton: HTMLButtonElement | undefined = $state()
    let restartOpen = $state(false)
    let displayButton: HTMLButtonElement | undefined = $state()
    let displayOpen = $state(false)
    let displayModalOpen = $state(false)
    const phone = new MediaQuery(PhoneLayoutQuery)
    const turnPlayerIds = $derived.by(() => {
        if (!session.isViewingHistory) return gameState.activePlayerIds
        const actorId = session.actions
            .slice(0, gameState.actionCount)
            .findLast((action) => !isHistoryBookkeeping(action))?.playerId
        return actorId ? [actorId] : gameState.activePlayerIds
    })
</script>

{#snippet turnLabel()}
    {#each turnPlayerIds as playerId (playerId)}
        <span class="player-name"
            ><span
                class="player-color"
                style:background={session.playerColorValue(playerId)}
                aria-hidden="true"
            ></span>{session.getPlayerName(playerId)}</span
        >
    {/each}
{/snippet}
<header
    aria-label="Game phase"
    use:fitRoundLabel
    class:compact
    class:centered
    class:borderless={!bordered}
    class:attention
>
    <div class="phase">
        <strong>
            {#if gameState.result}
                Game over
            {:else if opening}
                <span class="round-full" aria-hidden={compact}>{opening.name}</span><span
                    class="round-short"
                    aria-hidden={!compact}>{opening.abbreviation}</span
                >
            {:else if auction}
                <span class="auction-label max-sm:hidden">Opening auction</span><span
                    class="auction-label sm:hidden">Auction</span
                >
            {:else}
                {@const heading = currentRoundHeading(gameState, titleRounds)}
                <span class="round-full" aria-hidden={compact}>{heading.name}</span><span
                    class="round-short"
                    aria-hidden={!compact}>{heading.abbreviation}</span
                >
                {heading.number}
                {#if heading.roundCount}<span class="round-count">(of {heading.roundCount})</span
                    >{/if}
            {/if}
        </strong>
        {#if company && gameState.stockRound.completed && !gameState.result}<span
                class="separator"
                aria-hidden="true">/</span
            ><span class="company" title={session.companyName(company.id)}
                ><CompanyToken appearance={session.mapView.stations[company.id]} size={22} /><span
                    class="max-sm:hidden">{session.companyName(company.id)}</span
                ><span class="sm:hidden">{session.companyInitials(company.id)}</span></span
            >{/if}
        {#if centered && turnPlayerIds.length}<span class="separator" aria-hidden="true">/</span
            >{@render turnLabel()}{/if}
    </div>
    <div class="turn">
        <button
            onclick={() => session.undo()}
            disabled={session.busy ||
                session.updatingVisibleState ||
                session.isViewingHistory ||
                !(session.hasLocalSelection || session.undoableAction)}>Undo</button
        >
        {#if restart}
            <button
                class="restart"
                bind:this={restartButton}
                popovertarget={restartId}
                aria-expanded={restartOpen}
                aria-controls={restartId}
                aria-label="Restart turn"
                title="Restart turn"
                disabled={session.busy || session.updatingVisibleState}
                ><svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    ><path d="M4 5v6h6"></path><path d="M4.6 15a8 8 0 1 0 1.9-8.3L4 11"></path></svg
                ><span class="restart-label">Restart turn</span></button
            >
        {/if}
        <button
            class="display-toggle"
            bind:this={displayButton}
            popovertarget={phone.current ? undefined : `${headerId}-display`}
            onclick={phone.current ? () => (displayModalOpen = true) : undefined}
            aria-haspopup="dialog"
            aria-expanded={displayOpen || displayModalOpen}
            aria-controls={phone.current ? undefined : `${headerId}-display`}
            aria-label="Display"
            title="Display"
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
                ><path
                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                ></path><circle cx="12" cy="12" r="3"></circle></svg
            >
        </button>
    </div>
</header>
<DisplaySettings
    {session}
    id="{headerId}-display"
    anchor={displayButton}
    bind:open={displayOpen}
    bind:modalOpen={displayModalOpen}
/>
{#if restart}
    <RestartTurnConfirm
        {session}
        {restart}
        id={restartId}
        anchor={restartButton}
        bind:open={restartOpen}
    />
{/if}

<style>
    header {
        min-height: 44px;
        flex-shrink: 0;
        box-sizing: border-box;
        border-bottom: 1px solid var(--rail-pane-border, var(--rail-border, #b8a995));
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
    header.attention {
        --rail-text: var(--rail-surface-inset, #1b232d);
        --rail-muted: var(--rail-surface-inset, #1b232d);
        --rail-hover: #00000014;
        border-bottom-color: var(--rail-focus, #b8cddd);
        background: var(--rail-focus, #b8cddd);
    }
    header:not(.centered) {
        width: 100%;
        padding-left: 8px;
        flex-wrap: wrap;
        row-gap: 0;
    }
    header:not(.centered) .phase,
    header:not(.centered) .turn {
        max-width: 100%;
        flex-wrap: wrap;
    }
    header:not(.centered) .turn {
        margin-left: auto;
        justify-content: flex-end;
    }
    header:not(.centered) .company {
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
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
        position: relative;
        overflow-x: clip;
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
    .round-count {
        font: inherit;
        text-transform: none;
        letter-spacing: 0.02em;
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
    .restart {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: -8px;
    }
    .restart[aria-expanded='true'] {
        background: var(--rail-hover, #ffffff66);
    }
    .restart svg {
        flex-shrink: 0;
    }
    @media (width < 40rem) {
        .restart-label {
            display: none;
        }
    }
    .display-toggle {
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
    .display-toggle[aria-expanded='true'] {
        background: var(--rail-hover, #69554016);
        color: var(--rail-text, #443c34);
    }
</style>
