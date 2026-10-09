<script lang="ts">
    import type { Point } from '@tabletop/common'

    const GlowReach = 14

    let { id, line, color, width }: { id: string; line: Point[]; color: string; width: number } =
        $props()

    let points = $derived(line.map((point) => `${point.x},${point.y}`).join(' '))
    // The blur covers only this line: drawn over the whole board, it slowed every frame of the
    // route's dash animation.
    let region = $derived.by(() => {
        const xs = line.map((point) => point.x)
        const ys = line.map((point) => point.y)
        const x = Math.min(...xs) - GlowReach
        const y = Math.min(...ys) - GlowReach
        return {
            x,
            y,
            width: Math.max(...xs) + GlowReach - x,
            height: Math.max(...ys) + GlowReach - y
        }
    })
</script>

<!-- A soft glow in the line's colour beneath it, so routes and their branches read on the dimmed board. -->
<filter
    {id}
    filterUnits="userSpaceOnUse"
    x={region.x}
    y={region.y}
    width={region.width}
    height={region.height}
>
    <feGaussianBlur stdDeviation="4"></feGaussianBlur>
</filter>
<polyline
    class="route-glow"
    {points}
    fill="none"
    stroke={color}
    stroke-width={width + 4}
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.9"
    filter="url(#{id})"
></polyline>
