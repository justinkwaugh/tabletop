<script lang="ts">
    import { Color } from '@tabletop/common'
    import { PIECE_KINDS, PieceKind } from '@tabletop/punct'
    import { PIECE_HALF_WIDTH, VIEW } from '$lib/board/geometry.js'
    import { outlinePlan, pathOf } from '$lib/board/pieceShape.js'
    import { bodyBox, iconUrl } from '$lib/board/looks.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceSlab from './PieceSlab.svelte'

    // A piece drawn small, as on the board, lying the way it reads best: straight pieces across,
    // a triangle on its side, the angular pieces opening downward or along. Every kind is drawn
    // at one scale, screen pixels to a board unit, so the pieces keep their sizes side by side.
    let {
        color,
        kind,
        scale = 0.12,
        ring = false,
        ringRoom = true,
        live = false
    }: {
        color: Color
        kind: PieceKind
        scale?: number
        ring?: boolean
        // Room round it for the ring; without it, only the piece, so it fills its space. The
        // image is drawn with the room and its clear margin cut off.
        ringRoom?: boolean
        // Drawn without its image, as the looks page draws it for scripts/render-looks.mjs.
        live?: boolean
    } = $props()

    const ANGLES: Record<PieceKind, number> = {
        [PieceKind.Triangle]: 2.5,
        [PieceKind.StraightEnd]: 1.5,
        [PieceKind.StraightCentre]: 1.5,
        [PieceKind.AngleCorner]: 2,
        [PieceKind.AngleLeft]: 1.5,
        [PieceKind.AngleRight]: 1.5
    }
    const RING_REACH = 7
    const iconId = $props.id()
    const prefix = `punct-icon-${iconId}`

    const angle = $derived(ANGLES[kind])
    const ringPath = $derived(
        pathOf(
            outlinePlan(kind, angle, PIECE_HALF_WIDTH + RING_REACH).map((point) =>
                VIEW.project(point, 0)
            )
        )
    )
    // The whole body with its edge line, and the ring round its foot with its stroke, which the
    // tilt does not flatten as it does the ring's reach: what the image is drawn over.
    const ringed = $derived.by(() => {
        const body = bodyBox(kind, angle)
        const ring = outlinePlan(kind, angle, PIECE_HALF_WIDTH + RING_REACH).map((point) =>
            VIEW.project(point, 0)
        )
        const stroke = 4.5
        const xs = [
            body.x,
            body.x + body.width,
            ...ring.flatMap((point) => [point.x - stroke, point.x + stroke])
        ]
        const ys = [
            body.y,
            body.y + body.height,
            ...ring.flatMap((point) => [point.y - stroke, point.y + stroke])
        ]
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        }
    })
    const box = $derived(ringRoom ? ringed : bodyBox(kind, angle))
    const tone = $derived(color === Color.White ? 'light' : 'dark')
    const seed = $derived(900 + PIECE_KINDS.indexOf(kind))
    // Pre-rendered by scripts/render-looks.mjs: drawn live, each icon's own gradients and slices
    // made the player cards cost more to open than the board.
    const href = $derived(live ? undefined : iconUrl(kind, tone))
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
    {#if href}
        <image {href} x={ringed.x} y={ringed.y} width={ringed.width} height={ringed.height}></image>
    {:else}
        <defs><PieceDefs {prefix} /></defs>
        <PieceSlab {kind} {angle} {tone} {seed} {prefix} live />
    {/if}
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
