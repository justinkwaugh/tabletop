<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { ActionType, HydratedExpand, MachineState } from '@tabletop/indonesia'

    const gameSession = getGameSession()
    const SEA_HIGHLIGHT_FILL = '#93c5fd'
    const SEA_HIGHLIGHT_FILL_OPACITY = 0.38

    const myPlayerId: string | null = $derived(gameSession.myPlayer?.id ?? null)

    const shippingExpansionSeaHighlightAreaIds: readonly string[] = $derived.by(() => {
        if (
            gameSession.suppressBoardEffectsForHistory ||
            !myPlayerId ||
            !gameSession.isMyTurn ||
            gameSession.gameState.machineState !== MachineState.ShippingOperations ||
            !gameSession.validActionTypes.includes(ActionType.Expand) ||
            gameSession.activeRoutePreviewVisualState !== null ||
            gameSession.activeBoardPreviewIntent.source !== 'none'
        ) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        return Array.from(gameSession.gameState.validExpansionAreaIds(operatingCompanyId))
            .filter(
                (areaId) =>
                    !!boardAreaPathById(areaId) &&
                    HydratedExpand.canExpand(gameSession.gameState, myPlayerId, areaId)
            )
            .sort((left, right) => left.localeCompare(right))
    })
</script>

{#if shippingExpansionSeaHighlightAreaIds.length > 0}
    <g class="select-none" aria-label="Shipping expansion sea highlights">
        {#each shippingExpansionSeaHighlightAreaIds as areaId (areaId)}
            <Area
                areaId={areaId}
                fill={SEA_HIGHLIGHT_FILL}
                stroke="none"
                fillOpacity={SEA_HIGHLIGHT_FILL_OPACITY}
                pointer-events="none"
            />
        {/each}
    </g>
{/if}
