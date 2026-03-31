<script lang="ts">
    import {
        animatePlacedDeed,
        attachDeedPlacementAnimator,
        DeedPlacementAnimator
    } from '$lib/animators/deedPlacementAnimator.js'
    import { BOARD_AREA_PATH_BY_ID } from '$lib/definitions/boardGeometry.js'
    import Area from '$lib/components/Area.svelte'
    import CompanyDeed, { companyDeedStyleForType } from '$lib/components/CompanyDeed.svelte'
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import {
        deriveShippingDeedSeaOverlayState,
        type ShippingDeedSeaOverlayState
    } from '$lib/components/boardActionAreas/seaHighlight.js'
    import { deedPositionKey, deedPositionLookupKeys } from '$lib/utils/deeds.js'
    import { deedCardEntryForDeed, type DeedCardEntry } from '$lib/utils/deedCardEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { CompanyType, MachineState } from '@tabletop/indonesia'

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
    let animatedDeedCards: DeedCardEntry[] = $state([])
    let animatedDeedIdSet: ReadonlySet<string> = $state(new Set<string>())
    const deedPlacementAnimator = new DeedPlacementAnimator(gameSession, {
        showAnimatedDeedCards: ({ cards, animatedDeedIds }) => {
            animatedDeedCards = cards
            animatedDeedIdSet = new Set(animatedDeedIds)
        }
    })
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

            const cardEntry = deedCardEntryForDeed(deed)
            if (!cardEntry) {
                continue
            }
            const baseStyle = companyDeedStyleForType(cardEntry.cardKind)

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

            cards.push(cardEntry)

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
    function deedIdSignature(cards: readonly DeedCardEntry[]): string {
        return cards.map((card) => card.deedId).join('|')
    }

    const DISPLAYED_DEED_CARD_ENTRIES: DeedCardEntry[] = $derived.by(() => {
        if (animatedDeedCards.length === 0) {
            return DEED_CARD_ENTRIES
        }

        return deedIdSignature(animatedDeedCards) === deedIdSignature(DEED_CARD_ENTRIES)
            ? DEED_CARD_ENTRIES
            : animatedDeedCards
    })
    const DEED_OVERLAY_AREAS: OverlayArea[] = $derived(DEED_LAYER_DATA.overlays)
    const hoveredAvailableDeedId: string | null = $derived(gameSession.hoveredAvailableDeedId)
    const activeDeedPreviewId: string | null = $derived(gameSession.activeDeedPreviewId)
    const showAllDeedOverlays: boolean = $derived(
        !gameSession.suppressBoardEffectsForHistory &&
            gameSession.gameState.machineState === MachineState.Acquisitions
    )
    const shippingDeedIds: readonly string[] = $derived.by(() => {
        return DEED_CARD_ENTRIES.filter((deed) => deed.isShipping).map((deed) => deed.deedId)
    })
    const shippingDeedSeaOverlayState: ShippingDeedSeaOverlayState = $derived.by(() => {
        return deriveShippingDeedSeaOverlayState({
            shippingDeedIds,
            activeDeedPreviewId,
            showAllDeedOverlays,
            suppressBoardEffectsForHistory: gameSession.suppressBoardEffectsForHistory,
            cityReferenceCardPreviewWins: gameSession.cityReferenceCardPreviewWins
        })
    })
    const visibleShippingDeedIdSet: ReadonlySet<string> = $derived.by(() => {
        return new Set(shippingDeedSeaOverlayState.visibleShippingDeedIds)
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
    const visibleLandDeedOverlayAreas: OverlayArea[] = $derived.by(() => {
        return visibleDeedOverlayAreas.filter((overlay) => !overlay.isShipping)
    })
    const activeLandDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return []
        }
        return visibleLandDeedOverlayAreas.filter((overlay) => overlay.deedId === previewDeedId)
    })
    const inactiveLandDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return visibleLandDeedOverlayAreas
        }
        return visibleLandDeedOverlayAreas.filter((overlay) => overlay.deedId !== previewDeedId)
    })
    const visibleShippingDeedOverlayAreas: OverlayArea[] = $derived.by(() => {
        return DEED_OVERLAY_AREAS.filter(
            (overlay) => overlay.isShipping && visibleShippingDeedIdSet.has(overlay.deedId)
        )
    })
    const activeShippingDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = shippingDeedSeaOverlayState.activeShippingPreviewDeedId
        if (!previewDeedId) {
            return []
        }
        return visibleShippingDeedOverlayAreas.filter((overlay) => overlay.deedId === previewDeedId)
    })
    const inactiveShippingDeedPreviewOverlayAreas: OverlayArea[] = $derived.by(() => {
        const previewDeedId = shippingDeedSeaOverlayState.activeShippingPreviewDeedId
        if (!previewDeedId) {
            return visibleShippingDeedOverlayAreas
        }
        return visibleShippingDeedOverlayAreas.filter((overlay) => overlay.deedId !== previewDeedId)
    })
    const foregroundHoveredDeedCardEntry: DeedCardEntry | null = $derived.by(() => {
        const hoveredDeedId = hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return null
        }
        return DISPLAYED_DEED_CARD_ENTRIES.find((deed) => deed.deedId === hoveredDeedId) ?? null
    })
    const foregroundHoveredDeedCardEntries: DeedCardEntry[] = $derived.by(() => {
        return foregroundHoveredDeedCardEntry ? [foregroundHoveredDeedCardEntry] : []
    })
    const backgroundDeedCardEntries: DeedCardEntry[] = $derived.by(() => {
        const hoveredDeedId = hoveredAvailableDeedId
        if (!hoveredDeedId) {
            return DISPLAYED_DEED_CARD_ENTRIES
        }
        return DISPLAYED_DEED_CARD_ENTRIES.filter((deed) => deed.deedId !== hoveredDeedId)
    })

    const shouldDarkenDeedMarkersForCompanyHover: boolean = $derived.by(() => {
        if (gameSession.suppressBoardEffectsForHistory) {
            return false
        }
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return gameSession.activeCompanyPiecePreviewCompanyIds.length > 0
    })
</script>

<g
    class="select-none"
    aria-label="Available deeds layer"
    {@attach attachDeedPlacementAnimator(deedPlacementAnimator)}
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
            {#each inactiveLandDeedPreviewOverlayAreas as overlay (overlay.key)}
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

            {#each inactiveShippingDeedPreviewOverlayAreas as overlay (overlay.key)}
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

            {#each backgroundDeedCardEntries as deed (deed.key)}
                {#if animatedDeedIdSet.has(deed.deedId)}
                    <g
                        transform={`translate(${deed.cardX} ${deed.cardY})`}
                        use:animatePlacedDeed={{ animator: deedPlacementAnimator, deedId: deed.deedId }}
                    >
                        <CompanyDeed
                            type={deed.cardKind}
                            x={0}
                            y={0}
                            height={BOARD_DEED_CARD_HEIGHT}
                            text={deed.text}
                            textLayout={deed.textLayout}
                            shippingSizes={deed.shippingSizes}
                        />
                    </g>
                {:else}
                    <CompanyDeed
                        type={deed.cardKind}
                        x={deed.cardX}
                        y={deed.cardY}
                        height={BOARD_DEED_CARD_HEIGHT}
                        text={deed.text}
                        textLayout={deed.textLayout}
                        shippingSizes={deed.shippingSizes}
                    />
                {/if}
            {/each}
        </g>

        {#each activeLandDeedPreviewOverlayAreas as overlay (overlay.key)}
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

        {#each activeShippingDeedPreviewOverlayAreas as overlay (overlay.key)}
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

        {#each foregroundHoveredDeedCardEntries as hoveredDeed (hoveredDeed.deedId)}
            {#if animatedDeedIdSet.has(hoveredDeed.deedId)}
                <g
                    transform={`translate(${hoveredDeed.cardX} ${hoveredDeed.cardY})`}
                    use:animatePlacedDeed={{
                        animator: deedPlacementAnimator,
                        deedId: hoveredDeed.deedId
                    }}
                >
                    <CompanyDeed
                        type={hoveredDeed.cardKind}
                        x={0}
                        y={0}
                        height={BOARD_DEED_CARD_HEIGHT}
                        text={hoveredDeed.text}
                        textLayout={hoveredDeed.textLayout}
                        shippingSizes={hoveredDeed.shippingSizes}
                    />
                </g>
            {:else}
                <CompanyDeed
                    type={hoveredDeed.cardKind}
                    x={hoveredDeed.cardX}
                    y={hoveredDeed.cardY}
                    height={BOARD_DEED_CARD_HEIGHT}
                    text={hoveredDeed.text}
                    textLayout={hoveredDeed.textLayout}
                    shippingSizes={hoveredDeed.shippingSizes}
                />
            {/if}
        {/each}

        <g
            aria-hidden="true"
            onpointerleave={() => {
                gameSession.clearHoveredAvailableDeed()
            }}
        >
            {#each DISPLAYED_DEED_CARD_ENTRIES as deed (deed.key)}
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
                    onpointerenter={() => {
                        gameSession.hoverAvailableDeed(deed.deedId)
                    }}
                    onpointerleave={() => {
                        if (hoveredAvailableDeedId === deed.deedId) {
                            gameSession.clearHoveredAvailableDeed()
                        }
                    }}
                />
            {/each}
        </g>
    </g>
