<script lang="ts">
    import { Color } from '@tabletop/common'
    import { PIECE_KINDS, PieceKind } from '@tabletop/punct'
    import { PIECE_HALF_WIDTH, VIEW } from '$lib/board/geometry.js'
    import { drawPiece, outlinePlan, pathOf } from '$lib/board/pieceShape.js'
    import PieceSlab from './PieceSlab.svelte'

    // A piece drawn small, as on the board, lying the way it reads best: straight pieces across,
    // a triangle on its side, the angular pieces opening downward or along. Every kind is drawn
    // at one scale, screen pixels to a board unit, so the pieces keep their sizes side by side.
    let {
        color,
        kind,
        scale = 0.12,
        ring = false
    }: { color: Color; kind: PieceKind; scale?: number; ring?: boolean } = $props()

    const ANGLES: Record<PieceKind, number> = {
        [PieceKind.Triangle]: 2.5,
        [PieceKind.StraightEnd]: 1.5,
        [PieceKind.StraightCentre]: 1.5,
        [PieceKind.AngleCorner]: 2,
        [PieceKind.AngleLeft]: 1.5,
        [PieceKind.AngleRight]: 1.5
    }
    const RING_REACH = 7

    const angle = $derived(ANGLES[kind])
    const ringPath = $derived(
        pathOf(
            outlinePlan(kind, angle, PIECE_HALF_WIDTH + RING_REACH).map((point) =>
                VIEW.project(point, 0)
            )
        )
    )
    const box = $derived.by(() => {
        const drawing = drawPiece(kind, angle)
        const points = [
            ...drawing.top,
            ...outlinePlan(kind, angle, PIECE_HALF_WIDTH + RING_REACH + 3).map((point) =>
                VIEW.project(point, 0)
            )
        ]
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        }
    })
    const tone = $derived(color === Color.White ? 'light' : 'dark')
    const seed = $derived(900 + PIECE_KINDS.indexOf(kind))
</script>

<svg
    height={box.height * scale}
    width={box.width * scale}
    viewBox="{box.x} {box.y} {box.width} {box.height}"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    {#if ring}
        <path d={ringPath} class="ring under"></path>
        <path d={ringPath} class="ring over"></path>
    {/if}
    <PieceSlab {kind} {angle} {tone} {seed} />
</svg>

<style>
    .ring {
        fill: none;
        stroke-linejoin: round;
    }

    .ring.under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 7;
    }

    .ring.over {
        stroke: var(--punct-mark);
        stroke-width: 4.5;
    }
</style>
