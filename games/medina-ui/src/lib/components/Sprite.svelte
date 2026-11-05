<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { sheetSize, sheetUrl, spriteFrame, type SheetName } from '$lib/art/sprites.js'
    import { UNITS_PER_CELL } from '$lib/utils/boardGeometry.js'

    let {
        sheet,
        name,
        anchor,
        unitsPerCell = UNITS_PER_CELL
    }: { sheet: SheetName; name: string; anchor: Point; unitsPerCell?: number } = $props()

    const frame = $derived(spriteFrame(sheet, name))
    const size = $derived(sheetSize(sheet))
</script>

<svg
    x={anchor.x + frame.x * unitsPerCell}
    y={anchor.y + frame.y * unitsPerCell}
    width={frame.w * unitsPerCell}
    height={frame.h * unitsPerCell}
    viewBox="{frame.sx} {frame.sy} {frame.sw} {frame.sh}"
    preserveAspectRatio="none"
>
    <image href={sheetUrl(sheet)} width={size.width} height={size.height}></image>
</svg>
