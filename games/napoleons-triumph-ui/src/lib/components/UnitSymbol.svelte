<script lang="ts">
    import { UnitType } from '@tabletop/napoleons-triumph'

    let {
        type,
        width,
        height,
        top = 0,
        ink,
        ground = 'none',
        lineWidth,
        dotRadius,
        solid = false,
        guard = false,
        hollowDot = false
    }: {
        type: UnitType
        width: number
        height: number
        top?: number
        ink: string
        ground?: string
        lineWidth: number
        dotRadius: number
        solid?: boolean
        guard?: boolean
        hollowDot?: boolean
    } = $props()

    const GUARD_CROSS_WIDTH = 1.1

    const guardInfantry = $derived(guard && type === UnitType.Infantry)
    const bottom = $derived(top + height)
    const middle = $derived(top + height / 2)
</script>

<rect
    y={top}
    {width}
    {height}
    fill={guardInfantry ? ink : ground}
    stroke={ink}
    stroke-width={lineWidth}
></rect>
{#if type === UnitType.Artillery}
    <circle
        cx={width / 2}
        cy={middle}
        r={dotRadius}
        fill={hollowDot ? 'none' : ink}
        stroke={hollowDot ? ink : 'none'}
        stroke-width={lineWidth}
    ></circle>
{:else if type === UnitType.Cavalry}
    {#if solid}
        <polygon points="0,{top} 0,{bottom} {width},{bottom}" fill={ink}></polygon>
    {:else}
        <path d="M0 {bottom} L{width} {top}" fill="none" stroke={ink} stroke-width={lineWidth}
        ></path>
    {/if}
{:else if guardInfantry}
    <path
        d="M0 {top} L{width} {bottom} M{width} {top} L0 {bottom}"
        fill="none"
        stroke={ground}
        stroke-width={GUARD_CROSS_WIDTH}
    ></path>
{:else if solid}
    <polygon points="0,{top} {width / 2},{middle} 0,{bottom}" fill={ink}></polygon>
    <polygon points="{width},{top} {width / 2},{middle} {width},{bottom}" fill={ink}></polygon>
{:else}
    <path
        d="M0 {top} L{width} {bottom} M0 {bottom} L{width} {top}"
        fill="none"
        stroke={ink}
        stroke-width={lineWidth}
    ></path>
{/if}
