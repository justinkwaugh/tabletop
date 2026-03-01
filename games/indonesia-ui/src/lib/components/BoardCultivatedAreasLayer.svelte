<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
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

        const companyIdsByOwnerAreaGood = new Map<string, Set<string>>()
        const conflictRankByCompanyId = new Map<string, number>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }
            const company = companyById.get(area.companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }

            const ownerAreaGoodKey = `${company.owner}|${area.good}`
            const companyIds = companyIdsByOwnerAreaGood.get(ownerAreaGoodKey) ?? new Set<string>()
            companyIds.add(company.id)
            companyIdsByOwnerAreaGood.set(ownerAreaGoodKey, companyIds)
        }

        for (const companyIds of companyIdsByOwnerAreaGood.values()) {
            if (companyIds.size <= 1) {
                continue
            }

            for (const [index, companyId] of [...companyIds]
                .sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
                .entries()) {
                conflictRankByCompanyId.set(companyId, index)
            }
        }

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }

            const company = companyById.get(area.companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }

            const conflictRank = conflictRankByCompanyId.get(company.id)

            entries.push({
                key: area.id,
                areaId: area.id,
                ownerColor: gameSession.colors.getPlayerUiColor(company.owner),
                borderColor: shadeHexColor(gameSession.colors.getPlayerUiColor(company.owner), 0.38),
                hatchPatternId:
                    conflictRank === undefined || conflictRank === 0
                        ? null
                        : HATCH_PATTERN_IDS[(conflictRank - 1) % HATCH_PATTERN_IDS.length]
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
