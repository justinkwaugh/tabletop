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
    const GROUPED_ISLAND_OVERLAY_AREA_IDS = new Set([
        'A05',
        'A09',
        'A26',
        'D13',
        'C18',
        'C19',
        'C20',
        'F06',
        'F07'
    ])

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
        hatchPatternId: string | null
    }

    const DEED_HATCH_PATTERN_BY_KEY: Record<string, string> = {
        'R02:Shipping': 'deed-hatch-shipping',
        'R08:Shipping': 'deed-hatch-shipping',
        'R14:Shipping': 'deed-hatch-shipping',
        'R04:Production': 'deed-hatch-production',
        'R24:Production': 'deed-hatch-production'
    }
    const DEED_UNSTARTED_PRODUCTION_DOT_PATTERN_ID = 'deed-production-unstarted-dot'
    const DEED_UNSTARTED_PRODUCTION_DENSE_DOT_PATTERN_ID = 'deed-production-unstarted-dense-dot'
    const DEED_NEUTRAL_PATTERN_COLOR = '#2b231d'
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

            const legacyHatchPatternId = DEED_HATCH_PATTERN_BY_KEY[legacyPositionKey] ?? null
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
                const resolvedHatchPatternId = !isShipping
                    ? legacyHatchPatternId === 'deed-hatch-production'
                        ? DEED_UNSTARTED_PRODUCTION_DENSE_DOT_PATTERN_ID
                        : DEED_UNSTARTED_PRODUCTION_DOT_PATTERN_ID
                    : legacyHatchPatternId
                const overlayOpacity =
                    (GROUPED_ISLAND_OVERLAY_AREA_IDS.has(areaId) ? 0.7 : 1) *
                    (isShipping ? baseStyle.overlayOpacity : 1)
                overlays.push({
                    key: `${deed.id}-${areaId}`,
                    deedId: deed.id,
                    isShipping,
                    areaId,
                    fill: overlayFill,
                    stroke: overlayStroke,
                    opacity: overlayOpacity,
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
    const hoveredAvailableDeedId: string | null = $derived(gameSession.hoveredAvailableDeedId)
    const activeDeedPreviewId: string | null = $derived(gameSession.activeDeedPreviewId)
    const showAllDeedOverlays: boolean = $derived(
        !gameSession.suppressBoardEffectsForHistory &&
            gameSession.gameState.machineState === MachineState.Acquisitions
    )
    const showDeedsDuringExpansionSelection: boolean = $derived.by(() => {
        if (gameSession.suppressBoardEffectsForHistory) {
            return false
        }

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
            if (gameSession.suppressBoardEffectsForHistory) {
                return false
            }
            if (gameSession.cityReferenceCardPreviewWins) {
                return false
            }
            if (showAllDeedOverlays) {
                return true
            }
            return overlay.deedId === activeDeedPreviewId
        })
    )
    const activeDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return []
        }
        return visibleDeedOverlayAreas.filter((overlay) => overlay.deedId === previewDeedId)
    })
    const inactiveDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return visibleDeedOverlayAreas
        }
        return visibleDeedOverlayAreas.filter((overlay) => overlay.deedId !== previewDeedId)
    })
    const hoveredDeedCardEntry: DeedCardEntry | null = $derived.by(() => {
        const hoveredDeedId = hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return null
        }
        return DEED_CARD_ENTRIES.find((deed) => deed.deedId === hoveredDeedId) ?? null
    })
    const hoveredDeedCardEntries: DeedCardEntry[] = $derived.by(() => {
        return hoveredDeedCardEntry ? [hoveredDeedCardEntry] : []
    })
    const nonHoveredDeedCardEntries: DeedCardEntry[] = $derived.by(() => {
        const hoveredDeedId = hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return DEED_CARD_ENTRIES
        }
        return DEED_CARD_ENTRIES.filter((deed) => deed.deedId !== hoveredDeedId)
    })

    const shouldDarkenDeedMarkersForCompanyHover: boolean = $derived.by(() => {
        if (gameSession.suppressBoardEffectsForHistory) {
            return false
        }
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return gameSession.hoveredCompanyPreviewCompanyIds.length > 0
    })
</script>

{#if !hideDeedsDuringOperations}
    <g
        class="select-none"
        aria-label="Available deeds layer"
    >
        <defs>
            <pattern
                id={DEED_UNSTARTED_PRODUCTION_DOT_PATTERN_ID}
                patternUnits="userSpaceOnUse"
                width="20"
                height="20"
            >
                <circle cx="5.5" cy="5.5" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.38"></circle>
                <circle cx="15.5" cy="15.5" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.3"></circle>
            </pattern>
            <pattern
                id={DEED_UNSTARTED_PRODUCTION_DENSE_DOT_PATTERN_ID}
                patternUnits="userSpaceOnUse"
                width="16"
                height="16"
            >
                <circle cx="4" cy="4" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.34"></circle>
                <circle cx="12" cy="4" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.28"></circle>
                <circle cx="4" cy="12" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.28"></circle>
                <circle cx="12" cy="12" r="2.6" fill={DEED_NEUTRAL_PATTERN_COLOR} fill-opacity="0.34"></circle>
            </pattern>
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
        </defs>

        <g
            style={`filter:${shouldDarkenDeedMarkersForCompanyHover ? `brightness(${HOVER_COMPANY_DEEDS_BRIGHTNESS})` : 'none'}`}
        >
            {#each inactiveDeedPreviewOverlayAreas as overlay (overlay.key)}
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

            {#each nonHoveredDeedCardEntries as deed (deed.key)}
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
                            gameSession.hoverAvailableDeed(deed.deedId)
                        }}
                        onmouseleave={() => {
                            if (hoveredAvailableDeedId === deed.deedId) {
                                gameSession.clearHoveredAvailableDeed()
                            }
                        }}
                    />
                </g>
            {/each}
        </g>

        {#each activeDeedPreviewOverlayAreas as overlay (overlay.key)}
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

        {#each hoveredDeedCardEntries as hoveredDeed (hoveredDeed.deedId)}
            {@const hoveredDeedId = hoveredDeed.deedId}
            <g>
                <CompanyDeed
                    type={hoveredDeed.cardKind}
                    x={hoveredDeed.cardX}
                    y={hoveredDeed.cardY}
                    height={BOARD_DEED_CARD_HEIGHT}
                    text={hoveredDeed.text}
                    shippingSizes={hoveredDeed.shippingSizes}
                />
                <rect
                    x={hoveredDeed.cardX - BOARD_DEED_CARD_WIDTH / 2}
                    y={hoveredDeed.cardY - BOARD_DEED_CARD_HEIGHT / 2}
                    width={BOARD_DEED_CARD_WIDTH}
                    height={BOARD_DEED_CARD_HEIGHT}
                    rx={BOARD_DEED_CARD_CORNER_RX}
                    ry={BOARD_DEED_CARD_CORNER_RY}
                    fill="#ffffff"
                    fill-opacity="0.001"
                    stroke="none"
                    pointer-events="all"
                    onmouseenter={() => {
                        gameSession.hoverAvailableDeed(hoveredDeedId)
                    }}
                    onmouseleave={() => {
                        if (hoveredAvailableDeedId === hoveredDeedId) {
                            gameSession.clearHoveredAvailableDeed()
                        }
                    }}
                />
            </g>
        {/each}
    </g>
{/if}
