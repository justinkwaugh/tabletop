<script lang="ts">
    import { BOARD_AREA_PATH_BY_ID } from '$lib/definitions/boardGeometry.js'
    import { getRegionAreaIds, getRegionName } from '$lib/definitions/regions.js'
    import Area from '$lib/components/Area.svelte'
    import CompanyDeed, {
        companyDeedStyleForType,
        deedCardKindFor
    } from '$lib/components/CompanyDeed.svelte'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import { shadeHexColor } from '$lib/utils/color.js'
    import {
        deedPositionKey,
        shippingSizeEntriesFromRecord,
        type ShippingSizeEntry
    } from '$lib/utils/deeds.js'
    import type { CompanyCardType } from '$lib/types/companyCard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { CompanyType } from '@tabletop/indonesia'

    const gameSession = getGameSession()

    type DeedCardEntry = {
        key: string
        text: string
        cardKind: CompanyCardType
        shippingSizes: readonly ShippingSizeEntry[] | null
        cardX: number
        cardY: number
    }

    type OverlayArea = {
        key: string
        areaId: string
        fill: string
        stroke: string
        opacity: number
    }

    const CARD_HEIGHT = 58
    const DEED_DARKNESS_SHIFT_BY_KEY: Record<string, number> = {
        'R08:Shipping': 0.15,
        'R14:Shipping': 0.15,
        'R26:Production': 0.1
    }

    const DEED_LAYER_DATA: {
        cards: DeedCardEntry[]
        overlays: OverlayArea[]
    } = $derived.by(() => {
        const deeds = gameSession.gameState.availableDeeds

        const cards: DeedCardEntry[] = []
        const overlays: OverlayArea[] = []

        for (const deed of deeds) {
            const regionId = deed.region
            const positionKey = deedPositionKey(regionId, deed.type)
            const isShipping = deed.type === CompanyType.Shipping
            if (!isShipping && deed.type !== CompanyType.Production) {
                continue
            }

            const regionName = getRegionName(regionId)
            const cardKind = deedCardKindFor(deed)
            const baseStyle = companyDeedStyleForType(cardKind)
            const cardPosition = DEED_CARD_POSITIONS[positionKey]
            if (!cardPosition) {
                continue
            }

            const darknessShift = DEED_DARKNESS_SHIFT_BY_KEY[positionKey] ?? 0
            const overlayFill =
                darknessShift === 0
                    ? baseStyle.overlayFill
                    : shadeHexColor(baseStyle.overlayFill, darknessShift)
            const overlayStroke =
                darknessShift === 0
                    ? baseStyle.overlayStroke
                    : shadeHexColor(baseStyle.overlayStroke, darknessShift * 0.7)
            const overlayAreaIds = isShipping
                ? gameSession.gameState.board
                      .seaAreasForRegion(regionId)
                      .map((seaArea) => seaArea.id)
                      .filter((seaAreaId) => BOARD_AREA_PATH_BY_ID.has(seaAreaId))
                : getRegionAreaIds(regionId)

            cards.push({
                key: positionKey,
                text: regionName,
                cardKind,
                shippingSizes: isShipping ? shippingSizeEntriesFromRecord(deed.sizes) : null,
                cardX: cardPosition.x,
                cardY: cardPosition.y
            })

            for (const areaId of overlayAreaIds) {
                overlays.push({
                    key: `${positionKey}-${areaId}`,
                    areaId,
                    fill: overlayFill,
                    stroke: overlayStroke,
                    opacity: baseStyle.overlayOpacity
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
</script>

<g class="pointer-events-none select-none" aria-label="Available deeds layer">
    {#each DEED_OVERLAY_AREAS as overlay (overlay.key)}
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
        />
    {/each}

    {#each DEED_CARD_ENTRIES as deed (deed.key)}
        <CompanyDeed
            type={deed.cardKind}
            x={deed.cardX}
            y={deed.cardY}
            height={CARD_HEIGHT}
            text={deed.text}
            shippingSizes={deed.shippingSizes}
        />
    {/each}
</g>
