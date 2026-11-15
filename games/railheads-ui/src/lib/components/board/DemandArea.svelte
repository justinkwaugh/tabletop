<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { DemandAreaDefinition } from '@tabletop/railheads'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './IndustryMark.svelte'

    let { area, center, radius }: { area: DemandAreaDefinition; center: Point; radius: number } =
        $props()

    const MARK_SPACING = 0.42
    const NAME_WIDTH = 1.6

    const label = $derived(
        `${area.name} wants ${area.industries.map((industry) => INDUSTRY_STYLE[industry].name).join(' and ')}`
    )
</script>

<g transform="translate({center.x} {center.y})" role="img" aria-label="Towards {label}">
    <title>Towards {label}: track beside it lets a company build those industry sites</title>
    {#each area.industries as industry, index (industry)}
        <g transform="translate({(index - 0.5) * 2 * MARK_SPACING * radius} {-radius * 0.38})">
            <IndustryMark {industry} scale={radius / 44} />
        </g>
    {/each}
    <text y={radius * 0.22} class="towards" font-size={radius * 0.24}>TOWARDS</text>
    <text
        y={radius * 0.56}
        class="name"
        font-size={radius * 0.34}
        textLength={area.name.length > 9 ? radius * NAME_WIDTH : undefined}
        lengthAdjust="spacingAndGlyphs">{area.name.toUpperCase()}</text
    >
</g>

<style>
    g {
        pointer-events: none;
    }

    text {
        fill: #fbf3dc;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
