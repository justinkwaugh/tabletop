<script lang="ts">
    import type { Allowance } from '@tabletop/magna-grecia'
    import { BuildTool, EndTurnOutcome } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LastActionDescription from './LastActionDescription.svelte'
    import ResupplyPicker from './ResupplyPicker.svelte'

    const gameSession = getGameSession()

    const TOOL_LABELS: Record<BuildTool, string> = {
        [BuildTool.Road]: 'Roads',
        [BuildTool.City]: 'Cities',
        [BuildTool.Market]: 'Build market',
        [BuildTool.Sell]: 'Sell market'
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
        key: string
        label: string
        split: Allowance
        active: boolean
        choose: () => void
    }

    const tileButtons: TileButton[] = $derived([
        ...tileTools.map((tool) => ({
            key: tool,
            label: TOOL_LABELS[tool],
            split: tool === BuildTool.Road ? gameSession.roadAllowance : gameSession.cityAllowance,
            active: gameSession.activeTool === tool,
            choose: () => gameSession.chooseTool(tool)
        })),
        ...(gameSession.resupplyAllowance > 0
            ? [
                  {
                      key: 'resupply',
                      label: 'Resupply',
                      split: gameSession.resupplySplit,
                      active: gameSession.resupplyOpen,
                      choose: () => gameSession.toggleResupply()
                  }
              ]
            : [])
    ])

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
        return tookTileAction ? 'Done' : 'Skipped'
    })

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
                return 'Place a road tile beside a city or continuing your road'
            case BuildTool.City:
                return 'Found or expand a city (1 point per tile). Dotted spaces commit you to building on to a village this turn'
            case BuildTool.Market:
                return 'Build a market in a village or rival city'
            case BuildTool.Sell:
                return 'Sell an active market for its value'
            default:
                if (gameSession.onlyEndTurnLeft) {
                    return 'Your turn is complete: end your turn'
                }
                return tileTools.length > 0
                    ? 'Choose an action'
                    : 'Build or sell a market, or end your turn'
        }
    })

    const hint = $derived.by(() => {
        if (gameSession.cityUnfinished) {
            return undefined
        }
        if (gameSession.onlyEndTurnLeft) {
            switch (gameSession.endTurnOutcome) {
                case EndTurnOutcome.RevealsCard:
                    return 'Ending your turn starts the next round and reveals a new action card. It cannot be undone.'
                case EndTurnOutcome.NextRound:
                    return 'Ending your turn starts the next round.'
                case EndTurnOutcome.EndsGame:
                    return 'Ending your turn ends the game.'
                default:
                    return undefined
            }
        }
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
            case BuildTool.Market:
            case BuildTool.Sell:
                return gameSession.tileActionsOpen
                    ? 'A market action skips the tile actions you have left'
                    : undefined
            default:
                return undefined
        }
    })
</script>

<div class="flex min-h-[50px] flex-col items-center justify-center gap-1 px-4 py-1 text-[#4a2c12]">
    {#if !gameSession.canAct}
        <LastActionDescription
            fallbackText={gameSession.isViewingHistory ? 'Viewing history' : 'Waiting for turn'}
        />
    {:else}
        <div class="text-center text-[17px] tracking-[0.02em]">{message}</div>
        {#if hint}
            <div class="hint" class:warning={gameSession.onlyEndTurnLeft}>{hint}</div>
        {/if}
        {#if !gameSession.cityUnfinished}
            <div class="phases">
                <div class="phase" class:closed={!gameSession.tileActionsOpen}>
                    <div class="phase-label">1 · Two actions, or one ★ enhanced</div>
                    <div class="phase-buttons">
                        {#each tileButtons as { key, label, split, active, choose } (key)}
                            <button type="button" class="tool" class:active onclick={choose}>
                                {label}
                                {#if split.basic > 0}
                                    <span class="count">{split.basic}</span>
                                {/if}
                                {#if split.bonus > 0}
                                    <span class="bonus" title={BONUS_TIP}>+{split.bonus} ★</span>
                                {/if}
                            </button>
                        {/each}
                        {#if !gameSession.tileActionsOpen}
                            <span class="phase-status">{tileStatus}</span>
                        {/if}
                    </div>
                </div>
                <span class="arrow" aria-hidden="true">›</span>
                <div class="phase" class:closed={!gameSession.marketActionsOpen}>
                    <div class="phase-label">2 · Market</div>
                    <div class="phase-buttons">
                        {#each marketTools as tool (tool)}
                            <button
                                type="button"
                                class="tool"
                                class:active={gameSession.activeTool === tool}
                                onclick={() => gameSession.chooseTool(tool)}
                            >
                                {TOOL_LABELS[tool]}
                            </button>
                        {/each}
                        {#if !gameSession.marketActionsOpen}
                            <span class="phase-status">{marketStatus}</span>
                        {/if}
                    </div>
                </div>
                <span class="arrow" aria-hidden="true">›</span>
                <div class="phase">
                    <div class="phase-label">3 · Finish</div>
                    <div class="phase-buttons">
                        {#if gameSession.canEndTurn}
                            <button
                                type="button"
                                class="tool end"
                                class:ready={gameSession.onlyEndTurnLeft}
                                onclick={() => gameSession.endTurn()}
                            >
                                End turn
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
            {#if gameSession.resupplyOpen}
                <ResupplyPicker />
            {/if}
        {/if}
    {/if}
</div>

<style>
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
        min-height: 30px;
    }

    .phase-status {
        font-size: 13px;
        font-style: italic;
        color: rgba(74, 44, 18, 0.55);
    }

    .arrow {
        align-self: flex-end;
        padding-bottom: 4px;
        font-size: 20px;
        line-height: 1;
        color: rgba(107, 63, 29, 0.55);
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
        border: 1.5px solid rgba(107, 63, 29, 0.55);
        padding: 3px 12px;
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

    .count {
        min-width: 20px;
        border-radius: 999px;
        padding: 0 5px;
        font-size: 13px;
        text-align: center;
        background: rgba(107, 63, 29, 0.15);
    }

    .bonus {
        border-radius: 999px;
        padding: 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: #5a3a06;
        background: #f1cf74;
        box-shadow: inset 0 0 0 1px rgba(138, 90, 18, 0.55);
    }

    .tool.active .count {
        background: rgba(251, 243, 220, 0.25);
    }
</style>
