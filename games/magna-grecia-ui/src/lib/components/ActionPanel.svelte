<script lang="ts">
    import { EndTurnOutcome, type Allowance } from '@tabletop/magna-grecia'
    import { BuildTool } from '$lib/model/buildTool.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ActionAllowanceKind } from '$lib/utils/actionAllowances.js'
    import AllowanceList from './AllowanceList.svelte'
    import AllowanceIcon from './icons/AllowanceIcon.svelte'
    import MarketIcon from './icons/MarketIcon.svelte'
    import PointsIcon from './icons/PointsIcon.svelte'
    import LastActionDescription from './LastActionDescription.svelte'
    import ResupplyPicker from './ResupplyPicker.svelte'

    const gameSession = getGameSession()

    const TOOL_LABELS: Record<BuildTool, string> = {
        [BuildTool.Road]: 'Roads',
        [BuildTool.City]: 'Cities',
        [BuildTool.Market]: 'Build market',
        [BuildTool.Sell]: 'Sell market'
    }

    const MARKET_SHORT_LABELS: Partial<Record<BuildTool, string>> = {
        [BuildTool.Market]: 'Buy',
        [BuildTool.Sell]: 'Sell'
    }

    const ENHANCED_NOUNS = { roads: 'roads', cities: 'cities' } as const

    const tileTools = $derived(
        gameSession.availableTools.filter(
            (tool) => tool === BuildTool.Road || tool === BuildTool.City
        )
    )
    const marketTools = $derived(
        gameSession.availableTools.filter(
            (tool) => tool === BuildTool.Market || tool === BuildTool.Sell
        )
    )
    const turn = $derived(gameSession.gameState.turn)
    const tookTileAction = $derived(
        !!turn && (turn.roadsPlaced > 0 || turn.citiesPlaced > 0 || turn.resupplied)
    )
    const tookMarketAction = $derived(turn?.marketDone === true)

    const BONUS_TIP = 'Enhanced: only as your one action this turn'

    type TileButton = {
        kind: ActionAllowanceKind
        label: string
        split: Allowance
        active: boolean
        choose: () => void
    }

    const tileButtons: TileButton[] = $derived([
        ...tileTools.map((tool) => ({
            kind: tool === BuildTool.Road ? ('roads' as const) : ('cities' as const),
            label: TOOL_LABELS[tool],
            split: tool === BuildTool.Road ? gameSession.roadAllowance : gameSession.cityAllowance,
            active: gameSession.activeTool === tool,
            choose: () => gameSession.chooseTool(tool)
        })),
        ...(gameSession.resupplyAllowance > 0
            ? [
                  {
                      kind: 'resupply' as const,
                      label: 'Resupply',
                      split: gameSession.resupplySplit,
                      active: gameSession.resupplyOpen,
                      choose: () => gameSession.toggleResupply()
                  }
              ]
            : [])
    ])

    const marketToolChosen = $derived(
        gameSession.activeTool === BuildTool.Market || gameSession.activeTool === BuildTool.Sell
    )
    const shownTileButtons = $derived.by(() => {
        if (marketToolChosen) {
            return []
        }
        if (gameSession.resupplyOpen) {
            return tileButtons.filter((button) => button.kind === 'resupply')
        }
        return tileButtons
    })

    function allowanceHint(allowance: Allowance, plural: string, singular: string) {
        if (allowance.bonus === 0) {
            return undefined
        }
        if (allowance.basic === 0) {
            return `One more ${singular} makes this your ★ enhanced action, with no other tile action after it`
        }
        const basicNoun = allowance.basic === 1 ? singular : plural
        return `Up to ${allowance.basic} ${basicNoun} as one of two actions, or ${allowance.basic + allowance.bonus} as your only action (★ enhanced)`
    }

    const marketStatus = $derived(tookMarketAction ? 'Done' : 'None available')

    const tileStatus = $derived.by(() => {
        if (gameSession.enhancedAction) {
            return `Done: ★ enhanced ${ENHANCED_NOUNS[gameSession.enhancedAction]}`
        }
        if (tookTileAction) {
            return 'Done'
        }
        return tookMarketAction || marketToolChosen ? 'Skipped' : 'None available'
    })
    const mobileStep = $derived.by(() => {
        if (gameSession.onlyEndTurnLeft) {
            return 'finish'
        }
        if (gameSession.tileActionsOpen && !gameSession.tilesSkipped && !marketToolChosen) {
            return 'tiles'
        }
        return 'market'
    })
    const tilePhaseClosed = $derived(!gameSession.tileActionsOpen || marketToolChosen)

    // What ending the turn now would do, on every turn, not only once End turn is all that is left.
    const endTurnWarning = $derived.by(() => {
        switch (gameSession.endTurnOutcome) {
            case EndTurnOutcome.RevealsCard:
                return 'Ending your turn starts the next round and reveals a new action card. It cannot be undone.'
            case EndTurnOutcome.NextRound:
                return 'Ending your turn starts the final round.'
            case EndTurnOutcome.EndsGame:
                return 'Ending your turn ends the game. It cannot be undone.'
            default:
                return undefined
        }
    })
    const endTurnIsFinal = $derived(
        gameSession.endTurnOutcome === EndTurnOutcome.RevealsCard ||
            gameSession.endTurnOutcome === EndTurnOutcome.EndsGame
    )

    const CITY_PROMPT = 'Found or expand a city'
    const ROAD_PROMPT = 'Place a road tile'
    const PROMPT_DETAILS: Record<string, string> = {
        [ROAD_PROMPT]: 'beside a city or continuing your road',
        [CITY_PROMPT]:
            '(1 point per tile). Dotted spaces commit you to building on to a village this turn'
    }

    const message = $derived.by(() => {
        if (gameSession.pendingClaim) {
            return 'Finish the expansion: place a city tile on the village'
        }
        if (gameSession.pendingFounding) {
            return 'Keep building your new city until it covers a village'
        }
        if (gameSession.resupplyOpen) {
            return 'Choose tiles to move from staging to your supply'
        }
        if (gameSession.roadSpace) {
            if (!gameSession.roadPreview) {
                return 'Choose a straight or curved road tile'
            }
            return gameSession.roadPlacements.length > 1
                ? 'Click the tile to rotate it, then ✓ to place it'
                : 'Place the road tile with ✓, or ✕ to cancel'
        }
        switch (gameSession.activeTool) {
            case BuildTool.Road:
                return ROAD_PROMPT
            case BuildTool.City:
                return CITY_PROMPT
            case BuildTool.Market:
                return 'Build a market in a village or rival city'
            case BuildTool.Sell:
                return 'Sell an active market'
            default:
                if (gameSession.onlyEndTurnLeft) {
                    return 'Your turn is complete'
                }
                return tileTools.length > 0
                    ? 'Choose an action'
                    : 'Build or sell a market, or end your turn'
        }
    })

    const toolHint = $derived.by(() => {
        if (gameSession.resupplyOpen) {
            const split = gameSession.resupplySplit
            return split.bonus > 0
                ? `Move up to ${split.basic} as one of two actions, or up to ${split.basic + split.bonus} as your only action (★ enhanced)`
                : undefined
        }
        switch (gameSession.activeTool) {
            case BuildTool.Road:
                return allowanceHint(gameSession.roadAllowance, 'roads', 'road')
            case BuildTool.City:
                return allowanceHint(gameSession.cityAllowance, 'city tiles', 'city tile')
            default:
                return undefined
        }
    })
    // A chosen tool keeps the hint line; the End turn button then carries the warning.
    const hint = $derived.by(() => {
        if (gameSession.cityUnfinished) {
            return undefined
        }
        if (!gameSession.onlyEndTurnLeft && (gameSession.resupplyOpen || gameSession.activeTool)) {
            return toolHint
        }
        return endTurnWarning
    })
    const hintIsWarning = $derived(endTurnIsFinal && hint !== undefined && hint === endTurnWarning)
</script>

{#snippet chevron()}
    <svg class="chevron" width="14" height="24" viewBox="0 0 14 24" aria-hidden="true">
        <path d="M 3 3 L 11 12 L 3 21"></path>
    </svg>
{/snippet}

<div class="flex min-h-[50px] flex-col items-center justify-center gap-1 px-4 py-1 text-[#4a2c12]">
    {#if !gameSession.canAct}
        <LastActionDescription
            fallbackText={gameSession.isViewingHistory ? 'Viewing history' : 'Waiting for turn'}
        />
        <div class="round-actions">
            <AllowanceList
                card={gameSession.gameState.currentCard()}
                label="This round's actions"
                size={26}
            />
        </div>
    {:else}
        <div class="message">
            {message}
            {#if PROMPT_DETAILS[message]}
                <span class="message-detail">{PROMPT_DETAILS[message]}</span>
            {/if}
        </div>
        {#if hint}
            <div class="hint" class:warning={hintIsWarning}>{hint}</div>
        {/if}
        {#if !gameSession.cityUnfinished}
            <div class="phases" data-step={mobileStep}>
                <div class="phase tiles" class:closed={tilePhaseClosed}>
                    <div class="phase-label">Two actions, or one ★ enhanced</div>
                    <div class="phase-buttons">
                        {#each shownTileButtons as { kind, label, split, active, choose } (kind)}
                            <button type="button" class="tool" class:active onclick={choose}>
                                <AllowanceIcon {kind} size={24} />
                                <span class="label">{label}</span>
                                <span class="allowance">
                                    <span class="count">{split.basic}</span>
                                    {#if split.bonus > 0}
                                        <sup class="bonus" title={BONUS_TIP}>+{split.bonus}</sup>
                                    {/if}
                                </span>
                            </button>
                        {/each}
                        {#if tilePhaseClosed}
                            <span class="phase-status">{tileStatus}</span>
                        {/if}
                    </div>
                    <button type="button" class="skip" onclick={() => gameSession.skipTiles()}>
                        Skip
                        {@render chevron()}
                    </button>
                </div>
                {@render chevron()}
                <div class="phase market" class:closed={!gameSession.marketActionsOpen}>
                    <div class="phase-label">Market</div>
                    <div class="phase-buttons">
                        {#each marketTools as tool (tool)}
                            <button
                                type="button"
                                class="tool"
                                class:active={gameSession.activeTool === tool}
                                onclick={() => gameSession.chooseTool(tool)}
                            >
                                <MarketIcon size={24} />
                                {#if tool === BuildTool.Sell}
                                    <PointsIcon size={18} />
                                {/if}
                                <span class="label">{TOOL_LABELS[tool]}</span>
                                <span class="short-label" aria-hidden="true"
                                    >{MARKET_SHORT_LABELS[tool]}</span
                                >
                            </button>
                        {/each}
                        {#if !gameSession.marketActionsOpen}
                            <span class="phase-status">{marketStatus}</span>
                        {/if}
                    </div>
                </div>
                {@render chevron()}
                <div class="phase finish">
                    <div class="phase-label">Finish</div>
                    <div class="phase-buttons">
                        {#if gameSession.canEndTurn}
                            <button
                                type="button"
                                class="tool end"
                                class:ready={gameSession.onlyEndTurnLeft}
                                class:caution={endTurnIsFinal && !gameSession.onlyEndTurnLeft}
                                title={endTurnWarning}
                                onclick={() => gameSession.endTurn()}
                            >
                                End turn
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
            {#if gameSession.resupplyOpen}
                <div class="appear">
                    <ResupplyPicker />
                </div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .message {
        text-align: center;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        letter-spacing: 0.02em;
    }

    .round-actions {
        padding: 4px 0 2px;
    }

    .phases {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: center;
        gap: 4px 8px;
    }

    .phase {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .phase-label {
        font-size: 11px;
        letter-spacing: 0.04em;
        color: rgba(74, 44, 18, 0.75);
    }

    .phase.closed .phase-label {
        color: rgba(74, 44, 18, 0.45);
    }

    .phase-buttons {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 38px;
    }

    .phase-status {
        font-size: 13px;
        font-style: italic;
        color: rgba(74, 44, 18, 0.55);
    }

    .chevron {
        flex-shrink: 0;
        align-self: flex-end;
        margin: 0 2px 7px;
        fill: none;
        stroke: rgba(107, 63, 29, 0.45);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .hint {
        max-width: 560px;
        text-align: center;
        font-size: 13px;
        color: rgba(74, 44, 18, 0.85);
    }

    .hint.warning {
        font-weight: 600;
        color: #8a2d12;
    }

    .tool {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        min-height: 38px;
        border: 1.5px solid rgba(107, 63, 29, 0.55);
        padding: 3px 14px;
        font-size: 15px;
        line-height: 1.4;
        color: #4a2c12;
        background: rgba(255, 250, 235, 0.6);
    }

    .tool:hover {
        background: rgba(255, 244, 214, 1);
    }

    .tool.active {
        background: #6b3f1d;
        border-color: #6b3f1d;
        color: #fbf3dc;
    }

    .tool.end {
        border-style: dashed;
    }

    .tool.end.caution {
        border: 2px solid #b0361a;
        color: #8a2d12;
        font-weight: 600;
    }

    .tool.end.ready {
        border-style: solid;
        border-color: #8a5a12;
        background: #e0a83a;
        color: #3b2208;
        font-weight: 600;
        box-shadow: 0 0 0 3px rgba(224, 168, 58, 0.45);
    }

    .tool.end.ready:hover {
        background: #ebb94f;
    }

    @media (prefers-reduced-motion: no-preference) {
        .tool.end.ready {
            animation: end-turn-ready 1.6s ease-in-out infinite;
        }
    }

    @keyframes end-turn-ready {
        50% {
            box-shadow: 0 0 0 6px rgba(224, 168, 58, 0.2);
        }
    }

    .tool > :global(svg:first-child) {
        margin-left: -6px;
    }

    .allowance {
        display: inline-flex;
        align-items: flex-start;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
        line-height: 1;
    }

    .count {
        font-size: 19px;
    }

    .bonus {
        margin: 2px 0 0 1px;
        font-size: 11px;
        line-height: 1;
        vertical-align: baseline;
    }

    .short-label,
    .skip {
        display: none;
    }

    .skip {
        align-items: center;
        gap: 2px;
        margin-top: 2px;
        padding: 1px 4px 1px 10px;
        border-radius: 999px;
        font-size: 13px;
        letter-spacing: 0.04em;
        color: rgba(74, 44, 18, 0.75);
    }

    .skip:hover {
        background: rgba(107, 63, 29, 0.08);
    }

    .skip :global(.chevron) {
        width: 9px;
        height: 14px;
        margin: 0;
        align-self: center;
    }

    @media (max-width: 639px) {
        .short-label {
            display: inline;
        }

        .phases > .chevron,
        .market .phase-label,
        .finish .phase-label,
        [data-step='tiles'] .market,
        [data-step='tiles'] .finish,
        [data-step='market'] .tiles,
        [data-step='finish'] .tiles,
        [data-step='finish'] .market {
            display: none;
        }

        [data-step='tiles'] .skip {
            display: inline-flex;
        }


        .message-detail,
        .hint:not(.warning) {
            display: none;
        }

        .phase-buttons {
            gap: 4px;
        }

        .tool {
            gap: 4px;
            padding: 3px 10px;
        }

        .label {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }

        .allowance {
            align-items: center;
        }

        .bonus {
            top: 0;
            margin: 0 0 0 2px;
            font-size: 13px;
        }

        .bonus::before {
            content: '(';
        }

        .bonus::after {
            content: ')';
        }
    }

    @media (prefers-reduced-motion: no-preference) {
        .tool,
        .phase-status,
        .hint,
        .round-actions,
        .appear {
            animation: appear 200ms ease-out both;
        }
    }

    @keyframes appear {
        from {
            opacity: 0;
            transform: translateY(3px);
        }
    }
</style>
