<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
    import { CompanyType, Good } from '@tabletop/indonesia'

    type CultivatedRenderEntry = {
        key: string
        areaId: string
        markerX: number
        markerY: number
        ownerColor: string
        borderColor: string
        good: Good
    }

    const gameSession = getGameSession()

    const CULTIVATED_AREA_FILL_OPACITY = 1
    const CULTIVATED_AREA_STROKE_WIDTH = 2.2
    const CULTIVATED_MARKER_HEIGHT = 30

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )

    const cultivatedEntries: CultivatedRenderEntry[] = $derived.by(() => {
        const entries: CultivatedRenderEntry[] = []

        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }

            const company = companyById.get(area.companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }

            const markerPosition = resolveLandMarkerPosition(area.id)
            if (!markerPosition) {
                continue
            }

            entries.push({
                key: area.id,
                areaId: area.id,
                markerX: markerPosition.x,
                markerY: markerPosition.y,
                ownerColor: gameSession.colors.getPlayerUiColor(company.owner),
                borderColor: shadeHexColor(gameSession.colors.getPlayerUiColor(company.owner), 0.38),
                good: company.good
            })
        }

        return entries
    })
</script>

<g class="pointer-events-none select-none" aria-label="Cultivated areas layer">
    {#each cultivatedEntries as cultivated (cultivated.key)}
        <Area
            areaId={cultivated.areaId}
            fill={cultivated.ownerColor}
            stroke={cultivated.borderColor}
            fillOpacity={CULTIVATED_AREA_FILL_OPACITY}
            strokeWidth={CULTIVATED_AREA_STROKE_WIDTH}
        />
    {/each}

    {#each cultivatedEntries as cultivated (cultivated.key)}
        {#if cultivated.good === Good.Rice}
            <RiceMarker
                x={cultivated.markerX}
                y={cultivated.markerY}
                height={CULTIVATED_MARKER_HEIGHT}
                outlineColor={cultivated.ownerColor}
            />
        {:else if cultivated.good === Good.Spice}
            <SpiceMarker
                x={cultivated.markerX}
                y={cultivated.markerY}
                height={CULTIVATED_MARKER_HEIGHT}
                outlineColor={cultivated.ownerColor}
            />
        {:else if cultivated.good === Good.Rubber}
            <RubberMarker
                x={cultivated.markerX}
                y={cultivated.markerY}
                height={CULTIVATED_MARKER_HEIGHT}
                outlineColor={cultivated.ownerColor}
            />
        {:else if cultivated.good === Good.Oil}
            <OilMarker
                x={cultivated.markerX}
                y={cultivated.markerY}
                height={CULTIVATED_MARKER_HEIGHT}
                outlineColor={cultivated.ownerColor}
            />
        {:else if cultivated.good === Good.SiapSaji}
            <SiapSajiMarker
                x={cultivated.markerX}
                y={cultivated.markerY}
                height={CULTIVATED_MARKER_HEIGHT}
                outlineColor={cultivated.ownerColor}
            />
        {/if}
    {/each}
</g>
