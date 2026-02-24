<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import {
        ActionType,
        HydratedPlaceCity,
        IndonesiaAreaType,
        PlaceCity
    } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    type AreaInteractionAction = 'place-city'
    type ActiveAreaInteraction = {
        action: AreaInteractionAction
        validAreaIds: readonly string[]
        outlineColor: string
    }

    let hoveredAreaId: string | null = $state(null)
    let applyingAreaAction = $state(false)

    const myPlayerId: string | null = $derived(gameSession.myPlayer?.id ?? null)

    const activeAreaInteraction: ActiveAreaInteraction | null = $derived.by(() => {
        if (!myPlayerId || !gameSession.isMyTurn || !gameSession.isNewEra) {
            return null
        }
        if (!gameSession.validActionTypes.includes(ActionType.PlaceCity)) {
            return null
        }

        const validAreaIds = Array.from(
            HydratedPlaceCity.validAreaIds(gameSession.gameState, myPlayerId)
        )
        if (validAreaIds.length === 0) {
            return null
        }

        return {
            action: 'place-city',
            validAreaIds,
            outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId)
        }
    })

    const validAreaIdSet: Set<string> = $derived.by(
        () => new Set(activeAreaInteraction?.validAreaIds ?? [])
    )

    const hoveredValidAreaId: string | null = $derived.by(() => {
        if (!hoveredAreaId || !validAreaIdSet.has(hoveredAreaId)) {
            return null
        }
        return hoveredAreaId
    })

    const maskedLandAreaIds: string[] = $derived.by(() => {
        if (!activeAreaInteraction) {
            return []
        }

        const maskedIds: string[] = []
        for (const area of gameSession.gameState.board) {
            if (area.type !== IndonesiaAreaType.Land) {
                continue
            }
            if (validAreaIdSet.has(area.id)) {
                continue
            }
            maskedIds.push(area.id)
        }
        return maskedIds
    })

    async function handleAreaClick(areaId: string): Promise<void> {
        if (!activeAreaInteraction || applyingAreaAction || !myPlayerId) {
            return
        }
        if (!validAreaIdSet.has(areaId)) {
            return
        }
        if (activeAreaInteraction.action !== 'place-city') {
            return
        }

        applyingAreaAction = true
        try {
            const action = gameSession.createPlayerAction(PlaceCity, {
                type: ActionType.PlaceCity,
                areaId
            })
            await gameSession.applyAction(action)
        } finally {
            applyingAreaAction = false
        }
    }
</script>

{#if activeAreaInteraction}
    <g class="select-none" aria-label="Board action areas layer">
        {#each maskedLandAreaIds as areaId (areaId)}
            <Area
                areaId={areaId}
                fill="#000000"
                stroke="none"
                fillOpacity="0.5"
                pointer-events="none"
            />
        {/each}

        {#each activeAreaInteraction.validAreaIds as areaId (areaId)}
            <Area
                areaId={areaId}
                fill="#ffffff"
                stroke="none"
                fillOpacity="0.001"
                strokeWidth="0"
                pointer-events={applyingAreaAction ? 'none' : 'all'}
                cursor={applyingAreaAction ? 'default' : 'pointer'}
                onmouseenter={() => {
                    hoveredAreaId = areaId
                }}
                onmouseleave={() => {
                    if (hoveredAreaId === areaId) {
                        hoveredAreaId = null
                    }
                }}
                onpointerdown={() => {
                    handleAreaClick(areaId)
                }}
            />
        {/each}

        {#if hoveredValidAreaId}
            <Area
                areaId={hoveredValidAreaId}
                fill="none"
                stroke={activeAreaInteraction.outlineColor}
                fillOpacity="0"
                strokeWidth="4"
                pointer-events="none"
            />
        {/if}
    </g>
{/if}
