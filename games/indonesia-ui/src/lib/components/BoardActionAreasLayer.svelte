<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { companyDeedStyleForType } from '$lib/components/CompanyDeed.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { deedPositionKey } from '$lib/utils/deeds.js'
    import {
        ActionType,
        CompanyType,
        HydratedPlaceCity,
        HydratedStartCompany,
        IndonesiaAreaType,
        MachineState
    } from '@tabletop/indonesia'

    const gameSession = getGameSession()
    const SHIPPING_HIGHLIGHT_STYLE = companyDeedStyleForType('ship')

    type AreaInteractionAction = 'place-city' | 'start-company' | 'expand'
    type ActiveAreaInteraction = {
        action: AreaInteractionAction
        validAreaIds: readonly string[]
        outlineColor: string
        maskedAreaType: IndonesiaAreaType
        maskInvalidAreas: boolean
    }

    type StartCompanyDeedEntry = {
        deedId: string
        type: CompanyType
        x: number
        y: number
    }

    let hoveredAreaId: string | null = $state(null)
    let hoveredStartCompanyDeedId: string | null = $state(null)
    let selectedStartCompanyDeedId: string | null = $state(null)
    let applyingAreaAction = $state(false)

    const myPlayerId: string | null = $derived(gameSession.myPlayer?.id ?? null)

    const startCompanySelectionEnabled: boolean = $derived.by(() => {
        return (
            !!myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions &&
            gameSession.gameState.availableDeeds.length > 0
        )
    })

    const canApplyStartCompanyAction: boolean = $derived.by(() => {
        return (
            !!myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions
        )
    })

    const startCompanyDeeds: StartCompanyDeedEntry[] = $derived.by(() => {
        if (!startCompanySelectionEnabled) {
            return []
        }

        const deeds: StartCompanyDeedEntry[] = []
        for (const deed of gameSession.gameState.availableDeeds) {
            const position = DEED_CARD_POSITIONS[deedPositionKey(deed.region, deed.type)]
            if (!position) {
                continue
            }

            deeds.push({
                deedId: deed.id,
                type: deed.type,
                x: position.x,
                y: position.y
            })
        }

        return deeds
    })

    const startCompanyDeedById: Map<string, StartCompanyDeedEntry> = $derived.by(() => {
        return new Map(startCompanyDeeds.map((deed) => [deed.deedId, deed]))
    })

    const selectedStartCompanyDeed: StartCompanyDeedEntry | null = $derived.by(() => {
        if (!selectedStartCompanyDeedId) {
            return null
        }
        return startCompanyDeedById.get(selectedStartCompanyDeedId) ?? null
    })

    const startCompanyValidAreaIds: readonly string[] = $derived.by(() => {
        if (!myPlayerId || !selectedStartCompanyDeed) {
            return []
        }

        return Array.from(
            HydratedStartCompany.validAreaIds(
                gameSession.gameState,
                myPlayerId,
                selectedStartCompanyDeed.deedId
            )
        )
    })

    const startCompanyDeedOutlineColor: string = $derived.by(() => {
        if (!myPlayerId) {
            return '#1f2937'
        }
        return gameSession.colors.getPlayerUiColor(myPlayerId)
    })

    const shippingExpandValidAreaIds: readonly string[] = $derived.by(() => {
        if (
            !myPlayerId ||
            !gameSession.isMyTurn ||
            gameSession.gameState.machineState !== MachineState.ShippingOperations ||
            !gameSession.validActionTypes.includes(ActionType.Expand)
        ) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        return Array.from(gameSession.gameState.validExpansionAreaIds(operatingCompanyId))
    })

    $effect(() => {
        if (!startCompanySelectionEnabled) {
            selectedStartCompanyDeedId = null
            hoveredStartCompanyDeedId = null
            hoveredAreaId = null
            return
        }

        if (selectedStartCompanyDeedId && !startCompanyDeedById.has(selectedStartCompanyDeedId)) {
            selectedStartCompanyDeedId = null
            hoveredAreaId = null
        }

        if (hoveredStartCompanyDeedId && !startCompanyDeedById.has(hoveredStartCompanyDeedId)) {
            hoveredStartCompanyDeedId = null
        }
    })

    const activeAreaInteraction: ActiveAreaInteraction | null = $derived.by(() => {
        if (
            myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.isNewEra &&
            gameSession.validActionTypes.includes(ActionType.PlaceCity)
        ) {
            const validAreaIds = Array.from(
                HydratedPlaceCity.validAreaIds(gameSession.gameState, myPlayerId)
            )
            if (validAreaIds.length === 0) {
                return null
            }

            return {
                action: 'place-city',
                validAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (myPlayerId && shippingExpandValidAreaIds.length > 0) {
            return {
                action: 'expand',
                validAreaIds: shippingExpandValidAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Sea,
                maskInvalidAreas: false
            }
        }

        if (myPlayerId && selectedStartCompanyDeed) {
            if (startCompanyValidAreaIds.length === 0) {
                return null
            }
            return {
                action: 'start-company',
                validAreaIds: startCompanyValidAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType:
                    selectedStartCompanyDeed.type === CompanyType.Shipping
                        ? IndonesiaAreaType.Sea
                        : IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        return null
    })

    const interactiveValidAreaIds: readonly string[] = $derived.by(() =>
        (activeAreaInteraction?.validAreaIds ?? []).filter((areaId) => boardAreaPathById(areaId))
    )

    const validAreaIdSet: Set<string> = $derived.by(() => new Set(interactiveValidAreaIds))

    const hoveredValidAreaId: string | null = $derived.by(() => {
        if (!hoveredAreaId || !validAreaIdSet.has(hoveredAreaId)) {
            return null
        }
        return hoveredAreaId
    })

    const maskedAreaIds: string[] = $derived.by(() => {
        if (!activeAreaInteraction || !activeAreaInteraction.maskInvalidAreas) {
            return []
        }

        const maskedIds: string[] = []
        for (const area of gameSession.gameState.board) {
            if (area.type !== activeAreaInteraction.maskedAreaType) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            if (validAreaIdSet.has(area.id)) {
                continue
            }
            maskedIds.push(area.id)
        }

        return maskedIds
    })

    const hoveredShippingCompanySeaAreaIds: readonly string[] = $derived.by(() => {
        const hoveredCompanyId = gameSession.hoveredOperatingCompanyId
        if (!hoveredCompanyId) {
            return []
        }

        const hoveredCompany = gameSession.gameState.companies.find(
            (company) => company.id === hoveredCompanyId
        )
        if (!hoveredCompany || hoveredCompany.type !== CompanyType.Shipping) {
            return []
        }

        const highlightedAreaIds: string[] = []
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('ships' in area) || area.ships.length === 0) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            if (!area.ships.includes(hoveredCompanyId)) {
                continue
            }
            highlightedAreaIds.push(area.id)
        }

        return highlightedAreaIds
    })

    async function handleAreaClick(areaId: string): Promise<void> {
        if (!activeAreaInteraction || applyingAreaAction || !myPlayerId) {
            return
        }
        if (!validAreaIdSet.has(areaId)) {
            return
        }

        applyingAreaAction = true
        try {
            if (activeAreaInteraction.action === 'place-city') {
                await gameSession.placeCity(areaId)
                return
            }

            if (activeAreaInteraction.action === 'expand') {
                await gameSession.expand(areaId)
                return
            }

            if (!selectedStartCompanyDeedId) {
                return
            }
            if (!canApplyStartCompanyAction) {
                return
            }

            await gameSession.startCompany(selectedStartCompanyDeedId, areaId)
            selectedStartCompanyDeedId = null
        } finally {
            applyingAreaAction = false
        }
    }

    function selectStartCompanyDeed(deedId: string): void {
        if (!startCompanySelectionEnabled || applyingAreaAction) {
            return
        }
        selectedStartCompanyDeedId = deedId
        hoveredAreaId = null
    }
</script>

{#if activeAreaInteraction || startCompanySelectionEnabled || hoveredShippingCompanySeaAreaIds.length > 0}
    <g class="select-none" aria-label="Board action areas layer">
        {#each hoveredShippingCompanySeaAreaIds as areaId (areaId)}
            <Area
                areaId={areaId}
                fill={SHIPPING_HIGHLIGHT_STYLE.overlayFill}
                stroke={SHIPPING_HIGHLIGHT_STYLE.overlayStroke}
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="1.9"
                strokeLineJoin="round"
                strokeLineCap="round"
                opacity={SHIPPING_HIGHLIGHT_STYLE.overlayOpacity}
                pointer-events="none"
            />
        {/each}

        {#if activeAreaInteraction}
            {#if activeAreaInteraction.action === 'expand'}
                {#each interactiveValidAreaIds as areaId (areaId)}
                    <Area
                        areaId={areaId}
                        fill={SHIPPING_HIGHLIGHT_STYLE.overlayFill}
                        stroke={SHIPPING_HIGHLIGHT_STYLE.overlayStroke}
                        fillOpacity="1"
                        fillRule="evenodd"
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity={SHIPPING_HIGHLIGHT_STYLE.overlayOpacity}
                        pointer-events="none"
                    />
                {/each}
            {/if}

            {#each maskedAreaIds as areaId (areaId)}
                <Area
                    areaId={areaId}
                    fill="#000000"
                    stroke="none"
                    fillOpacity="0.5"
                    pointer-events="none"
                />
            {/each}

            {#each interactiveValidAreaIds as areaId (areaId)}
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
        {/if}

        {#if startCompanySelectionEnabled}
            {#each startCompanyDeeds as deed (deed.deedId)}
                {@const isSelected = selectedStartCompanyDeedId === deed.deedId}
                {@const isHovered = hoveredStartCompanyDeedId === deed.deedId}
                <rect
                    x={deed.x - BOARD_DEED_CARD_WIDTH / 2}
                    y={deed.y - BOARD_DEED_CARD_HEIGHT / 2}
                    width={BOARD_DEED_CARD_WIDTH}
                    height={BOARD_DEED_CARD_HEIGHT}
                    rx={BOARD_DEED_CARD_CORNER_RX}
                    ry={BOARD_DEED_CARD_CORNER_RY}
                    fill={isSelected ? '#ffffff' : '#000000'}
                    fill-opacity={isSelected ? 0.14 : isHovered ? 0.08 : 0.001}
                    stroke={isSelected || isHovered ? startCompanyDeedOutlineColor : 'none'}
                    stroke-width={isSelected ? 3 : 2}
                    pointer-events={applyingAreaAction ? 'none' : 'all'}
                    cursor={applyingAreaAction ? 'default' : 'pointer'}
                    onmouseenter={() => {
                        hoveredStartCompanyDeedId = deed.deedId
                    }}
                    onmouseleave={() => {
                        if (hoveredStartCompanyDeedId === deed.deedId) {
                            hoveredStartCompanyDeedId = null
                        }
                    }}
                    onpointerdown={() => {
                        selectStartCompanyDeed(deed.deedId)
                    }}
                />
            {/each}
        {/if}
    </g>
{/if}
