<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'

    type SvgFillRule = SVGAttributes<SVGPathElement>['fill-rule']
    type SvgStrokeLineJoin = SVGAttributes<SVGPathElement>['stroke-linejoin']
    type SvgStrokeLineCap = SVGAttributes<SVGPathElement>['stroke-linecap']

    let {
        areaId,
        fill = 'transparent',
        stroke = '#111827',
        fillOpacity = 1,
        strokeWidth = 1.8,
        fillRule = 'evenodd',
        strokeLineJoin = 'round',
        strokeLineCap = 'round',
        opacity = 1,
        ...pathProps
    }: Omit<SVGAttributes<SVGPathElement>, 'd'> & {
        areaId: string
        fill?: string
        stroke?: string
        fillOpacity?: number | string
        strokeWidth?: number | string
        fillRule?: SvgFillRule
        strokeLineJoin?: SvgStrokeLineJoin
        strokeLineCap?: SvgStrokeLineCap
        opacity?: number | string
    } = $props()

    const d = $derived.by(() => {
        const path = boardAreaPathById(areaId)
        if (!path) {
            throw new Error(`Area.svelte could not resolve board path for area id "${areaId}"`)
        }
        return path
    })
</script>

<path
    {d}
    {fill}
    {stroke}
    fill-opacity={fillOpacity}
    stroke-width={strokeWidth}
    fill-rule={fillRule}
    stroke-linejoin={strokeLineJoin}
    stroke-linecap={strokeLineCap}
    {opacity}
    {...pathProps}
></path>
