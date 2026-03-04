<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { companyDeedStyleForType } from '$lib/components/CompanyDeed.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { productionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { CompanyType, Good } from '@tabletop/indonesia'

    type CultivatedRenderEntry = {
        key: string
        areaId: string
        fillColor: string
        borderColor: string
        baseTintPatternId: string | null
        hatchPatternId: string | null
    }

    const gameSession = getGameSession()

    const CULTIVATED_AREA_FILL_OPACITY = 1
    const CULTIVATED_AREA_STROKE_WIDTH = 3
    const HATCH_PATTERN_IDS = [
        'cultivated-hatch-diag-0',
        'cultivated-hatch-diag-1',
        'cultivated-hatch-diag-2',
        'cultivated-hatch-diag-3'
    ] as const
    const SIAP_SAJI_HATCH_PATTERN_IDS = [
        'cultivated-siapsaji-hatch-diag-0',
        'cultivated-siapsaji-hatch-diag-1',
        'cultivated-siapsaji-hatch-diag-2',
        'cultivated-siapsaji-hatch-diag-3'
    ] as const
    const SPICE_BASE_TINT_PATTERN_ID = 'cultivated-spice-base-tint'
    const SIAP_SAJI_BASE_TINT_PATTERN_ID = 'cultivated-siapsaji-base-tint'
    const SPICE_PRIMARY_TINT = companyDeedStyleForType('spice').textColor
    const SIAP_SAJI_PRIMARY_TINT = '#8a5067'
    const GOODS_OVERLAY_STYLE_BY_GOOD: Readonly<
        Record<
            Good,
            {
                fill: string
                stroke: string
            }
        >
    > = {
        [Good.Rice]: {
            fill: companyDeedStyleForType('rice').overlayFill,
            stroke: companyDeedStyleForType('rice').overlayStroke
        },
        [Good.Spice]: {
            fill: companyDeedStyleForType('spice').overlayFill,
            stroke: companyDeedStyleForType('spice').overlayStroke
        },
        [Good.Rubber]: {
            fill: companyDeedStyleForType('rubber').overlayFill,
            stroke: companyDeedStyleForType('rubber').overlayStroke
        },
        [Good.Oil]: {
            fill: companyDeedStyleForType('oil').overlayFill,
            stroke: companyDeedStyleForType('oil').overlayStroke
        },
        [Good.SiapSaji]: {
            fill: companyDeedStyleForType('siapsaji').overlayFill,
            stroke: companyDeedStyleForType('siapsaji').overlayStroke
        }
    } as const

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )

    const cultivatedEntries: CultivatedRenderEntry[] = $derived.by(() => {
        const entries: CultivatedRenderEntry[] = []
        const hatchVariantByCompanyId = productionHatchVariantByCompanyId(
            gameSession.gameState,
            HATCH_PATTERN_IDS.length,
            {
                mode: gameSession.productionZoneRenderStyle
            }
        )
        const renderByGoods = gameSession.productionZoneRenderStyle === 'goods'

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }

            const company = companyById.get(area.companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }

            const hatchVariant = hatchVariantByCompanyId.get(company.id)
            const ownerColor = gameSession.colors.getPlayerUiColor(company.owner)
            const goodsStyle = GOODS_OVERLAY_STYLE_BY_GOOD[company.good]

            entries.push({
                key: area.id,
                areaId: area.id,
                fillColor: renderByGoods ? goodsStyle.fill : ownerColor,
                borderColor: renderByGoods ? goodsStyle.stroke : shadeHexColor(ownerColor, 0.38),
                baseTintPatternId:
                    renderByGoods
                        ? company.good === Good.SiapSaji
                            ? SIAP_SAJI_BASE_TINT_PATTERN_ID
                            : company.good === Good.Spice
                              ? SPICE_BASE_TINT_PATTERN_ID
                              : null
                        : null,
                hatchPatternId:
                    hatchVariant === undefined
                        ? null
                        : company.good === Good.SiapSaji
                          ? SIAP_SAJI_HATCH_PATTERN_IDS[hatchVariant]
                          : HATCH_PATTERN_IDS[hatchVariant]
            })
        }

        return entries
    })
</script>

<g class="pointer-events-none select-none" aria-label="Cultivated areas layer">
    <defs>
        <pattern
            id="cultivated-hatch-diag-0"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(25)"
        >
            <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.22"></rect>
        </pattern>
        <pattern
            id="cultivated-hatch-diag-1"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(-25)"
        >
            <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.22"></rect>
        </pattern>
        <pattern
            id="cultivated-hatch-diag-2"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(35)"
        >
            <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.18"></rect>
        </pattern>
        <pattern
            id="cultivated-hatch-diag-3"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(-35)"
        >
            <rect x="0" y="0" width="12" height="24" fill="#ffffff" fill-opacity="0.18"></rect>
        </pattern>
        <pattern
            id="cultivated-siapsaji-hatch-diag-0"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(25)"
        >
            <rect x="0" y="0" width="12" height="24" fill={SIAP_SAJI_PRIMARY_TINT} fill-opacity="0.3"></rect>
        </pattern>
        <pattern
            id="cultivated-siapsaji-hatch-diag-1"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(-25)"
        >
            <rect x="0" y="0" width="12" height="24" fill={SIAP_SAJI_PRIMARY_TINT} fill-opacity="0.3"></rect>
        </pattern>
        <pattern
            id="cultivated-siapsaji-hatch-diag-2"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(35)"
        >
            <rect x="0" y="0" width="12" height="24" fill={SIAP_SAJI_PRIMARY_TINT} fill-opacity="0.26"></rect>
        </pattern>
        <pattern
            id="cultivated-siapsaji-hatch-diag-3"
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(-35)"
        >
            <rect x="0" y="0" width="12" height="24" fill={SIAP_SAJI_PRIMARY_TINT} fill-opacity="0.26"></rect>
        </pattern>
        <pattern
            id={SIAP_SAJI_BASE_TINT_PATTERN_ID}
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
                fill={SIAP_SAJI_PRIMARY_TINT}
                fill-opacity="0.14"
            ></rect>
        </pattern>
        <pattern
            id={SPICE_BASE_TINT_PATTERN_ID}
            patternUnits="userSpaceOnUse"
            width="24"
            height="24"
            patternTransform="rotate(-32)"
        >
            <rect x="0" y="0" width="12" height="24" fill={SPICE_PRIMARY_TINT} fill-opacity="0.14"></rect>
        </pattern>
    </defs>

    {#each cultivatedEntries as cultivated (cultivated.key)}
        <Area
            areaId={cultivated.areaId}
            fill={cultivated.fillColor}
            stroke={cultivated.borderColor}
            fillOpacity={CULTIVATED_AREA_FILL_OPACITY}
            strokeWidth={CULTIVATED_AREA_STROKE_WIDTH}
        />
        {#if cultivated.baseTintPatternId}
            <Area
                areaId={cultivated.areaId}
                fill={`url(#${cultivated.baseTintPatternId})`}
                stroke="transparent"
                fillOpacity={1}
                strokeWidth={0}
            />
        {/if}
        {#if cultivated.hatchPatternId}
            <Area
                areaId={cultivated.areaId}
                fill={`url(#${cultivated.hatchPatternId})`}
                stroke="transparent"
                fillOpacity={1}
                strokeWidth={0}
            />
        {/if}
    {/each}
</g>
