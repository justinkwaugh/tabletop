<script lang="ts">
    import { ActionType } from '@tabletop/magna-grecia'
    import { BuildTool } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LastActionDescription from './LastActionDescription.svelte'
    import ResupplyPicker from './ResupplyPicker.svelte'

    const gameSession = getGameSession()

    const playerId = $derived(gameSession.myPlayerId)
    const roadsLeft = $derived(
        playerId ? gameSession.gameState.roadPlacementsRemaining(playerId) : 0
    )
    const citiesLeft = $derived(
        playerId ? gameSession.gameState.cityPlacementsRemaining(playerId) : 0
    )
    const canEndTurn = $derived(gameSession.validActionTypes.includes(ActionType.EndTurn))

    const TOOL_LABELS: Record<BuildTool, string> = {
        [BuildTool.Road]: 'Roads',
        [BuildTool.City]: 'Cities',
        [BuildTool.Market]: 'Build market',
        [BuildTool.Sell]: 'Sell market'
    }

    function toolCount(tool: BuildTool): number | undefined {
        if (tool === BuildTool.Road) {
            return roadsLeft
        }
        if (tool === BuildTool.City) {
            return citiesLeft
        }
        return undefined
    }

    const message = $derived.by(() => {
        if (gameSession.pendingClaim) {
            return 'Finish the expansion: place a city tile on the village'
        }
        if (gameSession.roadSpace) {
            return 'Choose which way the road runs'
        }
        switch (gameSession.activeTool) {
            case BuildTool.Road:
                return 'Place a road tile beside a city or continuing your road'
            case BuildTool.City:
                return 'Found or expand a city (1 point per tile). Dotted spaces beside a village need a second tile on it'
            case BuildTool.Market:
                return 'Build a market in a village or rival city — this ends your turn'
            case BuildTool.Sell:
                return 'Sell an active market for its value — this ends your turn'
            default:
                return 'Build or sell a market, or end your turn'
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
        {#if !gameSession.pendingClaim}
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each gameSession.availableTools as tool (tool)}
                    <button
                        type="button"
                        class="tool"
                        class:active={gameSession.activeTool === tool}
                        onclick={() => gameSession.chooseTool(tool)}
                    >
                        {TOOL_LABELS[tool]}
                        {#if toolCount(tool) !== undefined}
                            <span class="count">{toolCount(tool)}</span>
                        {/if}
                    </button>
                {/each}
                {#if gameSession.resupplyAllowance > 0}
                    <button
                        type="button"
                        class="tool"
                        class:active={gameSession.resupplyOpen}
                        onclick={() => (gameSession.resupplyOpen = !gameSession.resupplyOpen)}
                    >
                        Resupply <span class="count">{gameSession.resupplyAllowance}</span>
                    </button>
                {/if}
                {#if canEndTurn}
                    <button type="button" class="tool end" onclick={() => gameSession.endTurn()}>
                        End turn
                    </button>
                {/if}
            </div>
            {#if gameSession.resupplyOpen}
                <ResupplyPicker />
            {/if}
        {/if}
    {/if}
</div>

<style>
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

    .count {
        min-width: 20px;
        border-radius: 999px;
        padding: 0 5px;
        font-size: 13px;
        text-align: center;
        background: rgba(107, 63, 29, 0.15);
    }

    .tool.active .count {
        background: rgba(251, 243, 220, 0.25);
    }
</style>
