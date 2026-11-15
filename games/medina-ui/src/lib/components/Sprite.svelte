<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        sheetSize,
        sheetUrl,
        spriteBox,
        spriteFrame,
        type SheetName
    } from '$lib/art/sprites.js'
    import { UNITS_PER_CELL } from '$lib/utils/boardGeometry.js'

    let {
        sheet,
        name,
        anchor,
        unitsPerCell = UNITS_PER_CELL
    }: { sheet: SheetName; name: string; anchor: Point; unitsPerCell?: number } = $props()

    // The image is the whole sheet, so without a clip WebKit sizes the piece's repaint area, and
    // every opacity fade of it, to the sheet: larger than the board.
    const uid = $props.id()
    const clipId = `medina-sprite-${uid}`
    const frame = $derived(spriteFrame(sheet, name))
    const box = $derived(spriteBox(sheet, name, anchor, unitsPerCell))
    const size = $derived(sheetSize(sheet))
</script>

<svg
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    viewBox="{frame.sx} {frame.sy} {frame.sw} {frame.sh}"
    preserveAspectRatio="none"
>
    <clipPath id={clipId}>
        <rect x={frame.sx} y={frame.sy} width={frame.sw} height={frame.sh}></rect>
    </clipPath>
    <image href={sheetUrl(sheet)} width={size.width} height={size.height} clip-path="url(#{clipId})"
    ></image>
</svg>
