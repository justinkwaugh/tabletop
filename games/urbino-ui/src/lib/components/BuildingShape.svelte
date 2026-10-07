<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { BUILDING_POINTS, BuildingStyle, BuildingType } from '@tabletop/urbino'
    import { isDarkColor } from '$lib/theme.js'

    let {
        buildingType,
        color,
        buildingStyle,
        footprint,
        shadow
    }: {
        buildingType: BuildingType
        color: string
        buildingStyle: BuildingStyle
        footprint: number
        shadow?: { offset: Point; blurred: boolean }
    } = $props()

    const half = $derived(footprint / 2)
    const roof = $derived.by(() => {
        if (buildingType === BuildingType.House || buildingStyle === BuildingStyle.PointPips) return 'flat'
        if (buildingType === BuildingType.Tower) return 'pyramid'
        return 'gable'
    })
    const pipCount = $derived(buildingStyle === BuildingStyle.PointPips ? BUILDING_POINTS[buildingType] : 0)

    const lit = $derived(`color-mix(in oklab, ${color} 72%, #fff4e0)`)
    const shaded = $derived(`color-mix(in oklab, ${color} 74%, #2a1406)`)
    const lower = $derived(`color-mix(in oklab, ${color} 88%, #2a1406)`)
    const edge = $derived(`color-mix(in oklab, ${color} 45%, #2a1406)`)
    const pip = $derived(
        isDarkColor(color)
            ? `color-mix(in oklab, ${color} 20%, #f6e6c6)`
            : `color-mix(in oklab, ${color} 30%, #2a1205)`
    )

    const shadowPoints = $derived.by(() => {
        if (!shadow) return ''
        const { x, y } = shadow.offset
        return [
            [-half, -half],
            [half, -half],
            [half + x, -half + y],
            [half + x, half + y],
            [-half + x, half + y],
            [-half, half]
        ]
            .map(([px, py]) => `${px},${py}`)
            .join(' ')
    })
</script>

{#if shadow}
    <polygon
        points={shadowPoints}
        fill="#3b2410"
        opacity={shadow.blurred ? 0.32 : 0.22}
        filter={shadow.blurred ? 'url(#urbino-soft-shadow)' : undefined}
    />
{/if}
<g stroke={edge} stroke-opacity="0.45" stroke-width={footprint / 52} stroke-linejoin="round">
    {#if roof === 'flat'}
        <rect x={-half} y={-half} width={footprint} height={footprint} rx={footprint / 21} style:fill={color} />
    {:else if roof === 'gable'}
        <rect x={-half} y={-half} width={half} height={footprint} style:fill={lit} />
        <rect x="0" y={-half} width={half} height={footprint} style:fill={shaded} />
    {:else}
        <polygon points="{-half},{-half} {half},{-half} 0,0" style:fill={color} />
        <polygon points="{-half},{-half} 0,0 {-half},{half}" style:fill={lit} />
        <polygon points="{half},{-half} {half},{half} 0,0" style:fill={shaded} />
        <polygon points="{-half},{half} 0,0 {half},{half}" style:fill={lower} />
    {/if}
</g>
{#each { length: pipCount } as _, index (index)}
    <circle
        cx="0"
        cy={(index - (pipCount - 1) / 2) * footprint * 0.243}
        r={footprint * 0.081}
        style:fill={pip}
        opacity="0.85"
    />
{/each}
