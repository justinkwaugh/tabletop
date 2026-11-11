<script lang="ts">
    import { TILE_SHEET } from '$lib/art/atlas.generated.js'
    import tilesUrl from '$lib/images/tiles.webp'
    import { assertExists } from '@tabletop/common'

    let { name, size, badge }: { name: string; size: number; badge?: number } = $props()

    const frames: Record<string, { sx: number; sy: number; sw: number; sh: number }> =
        TILE_SHEET.frames
    const frame = $derived.by(() => {
        const found = frames[name]
        assertExists(found, `No tile ${name}`)
        return found
    })
    const BADGE_RADIUS = 0.2
</script>

<rect
    x={-size / 2 + 0.03}
    y={-size / 2 + 0.05}
    width={size}
    height={size}
    rx="0.05"
    fill="#2a1609"
    opacity="0.55"
></rect>
<svg
    x={-size / 2}
    y={-size / 2}
    width={size}
    height={size}
    viewBox="{frame.sx} {frame.sy} {frame.sw} {frame.sh}"
    preserveAspectRatio="none"
>
    <image href={tilesUrl} width={TILE_SHEET.width} height={TILE_SHEET.height}></image>
</svg>
{#if badge !== undefined}
    <circle cx={size / 2 - 0.08} cy={-size / 2 + 0.08} r={BADGE_RADIUS} fill="#231610"></circle>
    <text
        x={size / 2 - 0.08}
        y={-size / 2 + 0.2}
        text-anchor="middle"
        style="font-family: 'Medina Display', Georgia, serif"
        font-weight="700"
        font-size="0.32"
        fill="#e6c595">{badge}</text
    >
{/if}
