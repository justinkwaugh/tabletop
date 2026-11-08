<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { drawPiece, pathOf, type Tone } from '$lib/board/pieceShape.js'

    // A piece's body round its PÜNCT, drawn live: its rounded side as slices, bottom first, each
    // shaded by the gradients in `PieceDefs` under the same prefix, then its flat top with a light
    // edge, so pieces crossing pieces of their colour part. The board shows pre-rendered images
    // of it (board/looks.ts) except while a piece turns.
    let {
        kind,
        angle,
        tone,
        prefix,
        view = VIEW
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        prefix: string
        view?: BoardView
    } = $props()

    const drawing = $derived(drawPiece(kind, angle, view))
</script>

<g class="body {tone}">
    {#each drawing.slices as slice, index (index)}
        <path d={pathOf(slice.points)} fill="url(#{prefix}-{tone}-{slice.shade})" class="slice"
        ></path>
    {/each}
    <path d={pathOf(drawing.top)} class="top"></path>
</g>

<style>
    .slice {
        stroke: none;
    }

    .light .top {
        fill: rgb(226 230 236);
        stroke: rgb(150 158 170);
        stroke-width: 1;
    }

    .dark .top {
        fill: rgb(44 48 52);
        stroke: rgb(115 122 130);
        stroke-width: 1.3;
    }
</style>
