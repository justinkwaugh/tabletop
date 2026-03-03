<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { productionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { CompanyType } from '@tabletop/indonesia'

    type CultivatedRenderEntry = {
        key: string
        areaId: string
        ownerColor: string
        borderColor: string
        hatchPatternId: string | null
    }

    const gameSession = getGameSession()

    const CULTIVATED_AREA_FILL_OPACITY = 1
    const CULTIVATED_AREA_STROKE_WIDTH = 2.2
    const HATCH_PATTERN_IDS = [
        'cultivated-hatch-diag-0',
        'cultivated-hatch-diag-1',
        'cultivated-hatch-diag-2',
        'cultivated-hatch-diag-3'
    ] as const

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )

    const cultivatedEntries: CultivatedRenderEntry[] = $derived.by(() => {
        const entries: CultivatedRenderEntry[] = []
        const hatchVariantByCompanyId = productionHatchVariantByCompanyId(
            gameSession.gameState,
            HATCH_PATTERN_IDS.length
        )

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }

            const company = companyById.get(area.companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }

            const hatchVariant = hatchVariantByCompanyId.get(company.id)

            entries.push({
                key: area.id,
                areaId: area.id,
                ownerColor: gameSession.colors.getPlayerUiColor(company.owner),
                borderColor: shadeHexColor(gameSession.colors.getPlayerUiColor(company.owner), 0.38),
                hatchPatternId:
                    hatchVariant === undefined ? null : HATCH_PATTERN_IDS[hatchVariant]
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
    </defs>

    {#each cultivatedEntries as cultivated (cultivated.key)}
        <Area
            areaId={cultivated.areaId}
            fill={cultivated.ownerColor}
            stroke={cultivated.borderColor}
            fillOpacity={CULTIVATED_AREA_FILL_OPACITY}
            strokeWidth={CULTIVATED_AREA_STROKE_WIDTH}
        />
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
