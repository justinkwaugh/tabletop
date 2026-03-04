<script lang="ts">
    import { BOARD_AREA_PATH_BY_ID } from '$lib/definitions/boardGeometry.js'
    import { getRegionName } from '$lib/definitions/regions.js'
    import Area from '$lib/components/Area.svelte'
    import CompanyDeed, {
        companyDeedStyleForType,
        deedCardKindFor
    } from '$lib/components/CompanyDeed.svelte'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import {
        deedPositionLookupKeys,
        deedPositionKey,
        shippingSizeEntriesFromRecord,
        type ShippingSizeEntry
    } from '$lib/utils/deeds.js'
    import type { CompanyCardType } from '$lib/types/companyCard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { ActionType, CompanyType, MachineState } from '@tabletop/indonesia'

    const gameSession = getGameSession()
    const HOVER_COMPANY_DEEDS_BRIGHTNESS = 0.74

    type DeedCardEntry = {
        key: string
        deedId: string
        isShipping: boolean
        text: string
        cardKind: CompanyCardType
        shippingSizes: readonly ShippingSizeEntry[] | null
        cardX: number
        cardY: number
    }

    type OverlayArea = {
        key: string
        deedId: string
        isShipping: boolean
        areaId: string
        fill: string
        stroke: string
        opacity: number
        baseTintPatternId: string | null
        hatchPatternId: string | null
    }

    const DEED_HATCH_PATTERN_BY_KEY: Record<string, string> = {
        'R02:Shipping': 'deed-hatch-shipping',
        'R08:Shipping': 'deed-hatch-shipping',
        'R14:Shipping': 'deed-hatch-shipping',
        'R04:Production': 'deed-hatch-production',
        'R24:Production': 'deed-hatch-production'
    }
    const DEED_SPICE_BASE_TINT_PATTERN_ID = 'deed-hatch-spice-base-tint'
    const DEED_SIAPSAJI_BASE_TINT_PATTERN_ID = 'deed-hatch-siapsaji-base-tint'
    const DEED_SIAPSAJI_HATCH_PATTERN_ID = 'deed-hatch-siapsaji'
    const DEED_SPICE_PRIMARY_TINT = companyDeedStyleForType('spice').textColor
    const DEED_SIAPSAJI_PRIMARY_TINT = '#8a5067'
    const DEED_LAYER_DATA: {
        cards: DeedCardEntry[]
        overlays: OverlayArea[]
    } = $derived.by(() => {
        const deeds = gameSession.gameState.availableDeeds

        const cards: DeedCardEntry[] = []
        const overlays: OverlayArea[] = []

        for (const deed of deeds) {
            const regionId = deed.region
            const positionKeys = deedPositionLookupKeys(deed)
            const legacyPositionKey = deedPositionKey(regionId, deed.type)
            const isShipping = deed.type === CompanyType.Shipping
            if (!isShipping && deed.type !== CompanyType.Production) {
                continue
            }

            const regionName = getRegionName(regionId)
            const cardKind = deedCardKindFor(deed)
            const baseStyle = companyDeedStyleForType(cardKind)
            const cardPosition = positionKeys
                .map((key) => DEED_CARD_POSITIONS[key])
                .find((point) => point !== undefined)
            if (!cardPosition) {
                continue
            }

            const hatchPatternId = DEED_HATCH_PATTERN_BY_KEY[legacyPositionKey] ?? null
            const overlayFill = baseStyle.overlayFill
            const overlayStroke = baseStyle.overlayStroke
            const overlayAreaIds = isShipping
                ? gameSession.gameState.board
                      .seaAreasForRegion(regionId)
                      .map((seaArea) => seaArea.id)
                      .filter((seaAreaId) => BOARD_AREA_PATH_BY_ID.has(seaAreaId))
                : gameSession.gameState.board
                      .areasForRegion(regionId)
                      .filter((area) => gameSession.gameState.board.canBeNewlyCultivated(area, deed.good))
                      .map((area) => area.id)
                      .filter((areaId) => BOARD_AREA_PATH_BY_ID.has(areaId))

            cards.push({
                key: deed.id,
                deedId: deed.id,
                isShipping,
                text: regionName,
                cardKind,
                shippingSizes: isShipping ? shippingSizeEntriesFromRecord(deed.sizes) : null,
                cardX: cardPosition.x,
                cardY: cardPosition.y
            })

            for (const areaId of overlayAreaIds) {
                const resolvedHatchPatternId =
                    cardKind === 'siapsaji' && hatchPatternId === 'deed-hatch-production'
                        ? DEED_SIAPSAJI_HATCH_PATTERN_ID
                        : hatchPatternId
                overlays.push({
                    key: `${deed.id}-${areaId}`,
                    deedId: deed.id,
                    isShipping,
                    areaId,
                    fill: overlayFill,
                    stroke: overlayStroke,
                    opacity: isShipping ? baseStyle.overlayOpacity : 1,
                    baseTintPatternId:
                        cardKind === 'spice'
                            ? DEED_SPICE_BASE_TINT_PATTERN_ID
                            : cardKind === 'siapsaji'
                              ? DEED_SIAPSAJI_BASE_TINT_PATTERN_ID
                              : null,
                    hatchPatternId: resolvedHatchPatternId
                })
            }
        }

        return {
            cards,
            overlays
        }
    })

    const DEED_CARD_ENTRIES: DeedCardEntry[] = $derived(DEED_LAYER_DATA.cards)
    const DEED_OVERLAY_AREAS: OverlayArea[] = $derived(DEED_LAYER_DATA.overlays)
    const showAllDeedOverlays: boolean = $derived(
        gameSession.gameState.machineState === MachineState.Acquisitions
    )
    const showDeedsDuringExpansionSelection: boolean = $derived.by(() => {
        const state = gameSession.gameState.machineState
        const inExpansionSubstate =
            state === MachineState.ShippingOperations || state === MachineState.ProductionOperations
        return inExpansionSubstate && gameSession.validActionTypes.includes(ActionType.Expand)
    })
    const hideDeedsDuringOperations: boolean = $derived.by(() => {
        const state = gameSession.gameState.machineState
        const inOperationsState =
            state === MachineState.Operations ||
            state === MachineState.ShippingOperations ||
            state === MachineState.ProductionOperations
        return inOperationsState && !showDeedsDuringExpansionSelection
    })
    const visibleDeedOverlayAreas: OverlayArea[] = $derived.by(() =>
        DEED_OVERLAY_AREAS.filter((overlay) => {
            if (showAllDeedOverlays) {
                return true
            }
            return overlay.deedId === gameSession.hoveredAvailableDeedId
        })
    )
    const hoveredAvailableDeedOverlayAreas: OverlayArea[] = $derived.by(() => {
        const hoveredDeedId = gameSession.hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return []
        }
        return visibleDeedOverlayAreas.filter((overlay) => overlay.deedId === hoveredDeedId)
    })
    const nonHoveredVisibleDeedOverlayAreas: OverlayArea[] = $derived.by(() => {
        const hoveredDeedId = gameSession.hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return visibleDeedOverlayAreas
        }
        return visibleDeedOverlayAreas.filter((overlay) => overlay.deedId !== hoveredDeedId)
    })

    const shouldDarkenDeedMarkersForCompanyHover: boolean = $derived.by(() => {
        if (gameSession.hoveredCompanySpotlightCompanyIds.length > 0) {
            return true
        }
        return !!gameSession.hoveredOperatingCompanyId
    })
</script>

{#if !hideDeedsDuringOperations}
    <g
        class="select-none"
        aria-label="Available deeds layer"
    >
        <defs>
            <pattern
                id="deed-hatch-shipping"
                patternUnits="userSpaceOnUse"
                width="24"
                height="24"
                patternTransform="rotate(-35)"
            >
                <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.25"></rect>
            </pattern>
            <pattern
                id="deed-hatch-production"
                patternUnits="userSpaceOnUse"
                width="24"
                height="24"
                patternTransform="rotate(35)"
            >
                <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.24"></rect>
            </pattern>
            <pattern
                id={DEED_SIAPSAJI_HATCH_PATTERN_ID}
                patternUnits="userSpaceOnUse"
                width="24"
                height="24"
                patternTransform="rotate(35)"
            >
                <rect
                    x="0"
                    y="0"
                    width="12"
                    height="24"
                    fill={DEED_SIAPSAJI_PRIMARY_TINT}
                    fill-opacity="0.32"
                ></rect>
            </pattern>
            <pattern
                id={DEED_SPICE_BASE_TINT_PATTERN_ID}
                patternUnits="userSpaceOnUse"
                width="24"
                height="24"
                patternTransform="rotate(-32)"
            >
                <rect
                    x="0"
                    y="0"
                    width="12"
                    height="24"
                    fill={DEED_SPICE_PRIMARY_TINT}
                    fill-opacity="0.14"
                ></rect>
            </pattern>
            <pattern
                id={DEED_SIAPSAJI_BASE_TINT_PATTERN_ID}
                patternUnits="userSpaceOnUse"
                width="24"
                height="24"
                patternTransform="rotate(-32)"
            >
                <rect
                    x="0"
                    y="0"
                    width="12"
                    height="24"
                    fill={DEED_SIAPSAJI_PRIMARY_TINT}
                    fill-opacity="0.14"
                ></rect>
            </pattern>
        </defs>

        <g
            style={`filter:${shouldDarkenDeedMarkersForCompanyHover ? `brightness(${HOVER_COMPANY_DEEDS_BRIGHTNESS})` : 'none'}`}
        >
            {#each nonHoveredVisibleDeedOverlayAreas as overlay (overlay.key)}
                <Area
                    areaId={overlay.areaId}
                    fill={overlay.fill}
                    stroke={overlay.stroke}
                    fillOpacity="1"
                    fillRule="evenodd"
                    strokeWidth="1.9"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity={overlay.opacity}
                    pointer-events="none"
                />
                {#if overlay.baseTintPatternId}
                    <Area
                        areaId={overlay.areaId}
                        fill={`url(#${overlay.baseTintPatternId})`}
                        stroke="transparent"
                        fillOpacity={1}
                        strokeWidth={0}
                        opacity={overlay.opacity}
                        pointer-events="none"
                    />
                {/if}
                {#if overlay.hatchPatternId}
                    <Area
                        areaId={overlay.areaId}
                        fill={`url(#${overlay.hatchPatternId})`}
                        stroke="transparent"
                        fillOpacity={1}
                        strokeWidth={0}
                        opacity={overlay.opacity}
                        pointer-events="none"
                    />
                {/if}
            {/each}

            {#each DEED_CARD_ENTRIES as deed (deed.key)}
                <g>
                    <CompanyDeed
                        type={deed.cardKind}
                        x={deed.cardX}
                        y={deed.cardY}
                        height={BOARD_DEED_CARD_HEIGHT}
                        text={deed.text}
                        shippingSizes={deed.shippingSizes}
                    />
                    <rect
                        x={deed.cardX - BOARD_DEED_CARD_WIDTH / 2}
                        y={deed.cardY - BOARD_DEED_CARD_HEIGHT / 2}
                        width={BOARD_DEED_CARD_WIDTH}
                        height={BOARD_DEED_CARD_HEIGHT}
                        rx={BOARD_DEED_CARD_CORNER_RX}
                        ry={BOARD_DEED_CARD_CORNER_RY}
                        fill="#ffffff"
                        fill-opacity="0.001"
                        stroke="none"
                        pointer-events="all"
                        onmouseenter={() => {
                            gameSession.setHoveredAvailableDeed(deed.deedId)
                        }}
                        onmouseleave={() => {
                            if (gameSession.hoveredAvailableDeedId === deed.deedId) {
                                gameSession.setHoveredAvailableDeed(undefined)
                            }
                        }}
                    />
                </g>
            {/each}
        </g>

        {#each hoveredAvailableDeedOverlayAreas as overlay (overlay.key)}
            <Area
                areaId={overlay.areaId}
                fill={overlay.fill}
                stroke={overlay.stroke}
                fillOpacity="1"
                fillRule="evenodd"
                strokeWidth="1.9"
                strokeLineJoin="round"
                strokeLineCap="round"
                opacity={overlay.opacity}
                pointer-events="none"
            />
            {#if overlay.baseTintPatternId}
                <Area
                    areaId={overlay.areaId}
                    fill={`url(#${overlay.baseTintPatternId})`}
                    stroke="transparent"
                    fillOpacity={1}
                    strokeWidth={0}
                    opacity={overlay.opacity}
                    pointer-events="none"
                />
            {/if}
            {#if overlay.hatchPatternId}
                <Area
                    areaId={overlay.areaId}
                    fill={`url(#${overlay.hatchPatternId})`}
                    stroke="transparent"
                    fillOpacity={1}
                    strokeWidth={0}
                    opacity={overlay.opacity}
                    pointer-events="none"
                />
            {/if}
        {/each}
    </g>
{/if}
