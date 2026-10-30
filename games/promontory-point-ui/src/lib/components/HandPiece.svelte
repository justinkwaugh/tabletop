<script lang="ts">
    import { RAILROADS } from '@tabletop/promontory-point'
    import type { HandPieceView } from '$lib/model/seatView.js'
    import { TRACK_PIECE_RADIUS } from '$lib/utils/boardLayout.js'
    import TrackPiece from './board/TrackPiece.svelte'

    // `piece.faceShown` comes from the perspective rule (R-5), never from the hands the client holds.
    let { piece, size = 16 }: { piece: HandPieceView; size?: number } = $props()

    const extent = TRACK_PIECE_RADIUS * 1.2
    const label = $derived(
        piece.faceShown ? `${RAILROADS[piece.railroadId].name} track piece` : 'Hidden track piece'
    )
</script>

<svg
    class="hand-piece"
    width={size}
    height={size}
    viewBox="{-extent} {-extent} {extent * 2} {extent * 2}"
    role="img"
    aria-label={label}
    data-hand-piece={piece.faceShown ? piece.railroadId : 'hidden'}
>
    {#if piece.faceShown}
        <TrackPiece railroadId={piece.railroadId} />
    {:else}
        <!-- Art plan, "Drawn in code": a concealed piece is a grey disc marked "?". -->
        <circle
            r={TRACK_PIECE_RADIUS}
            fill="var(--pp-hidden)"
            stroke="var(--pp-halo)"
            stroke-width={TRACK_PIECE_RADIUS * 0.14}
        ></circle>
        <text
            text-anchor="middle"
            dominant-baseline="central"
            font-family="Oswald, sans-serif"
            font-weight="600"
            font-size={TRACK_PIECE_RADIUS * 1.1}
            fill="var(--pp-ink)">?</text
        >
    {/if}
</svg>

<style>
    .hand-piece {
        display: inline-block;
        flex: none;
    }
</style>
