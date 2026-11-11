<script lang="ts">
    import { RingAsset, assetUrl } from '$lib/art/assetMap.js'
    import PieceFrame from '$lib/components/pieces/PieceFrame.svelte'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'

    /**
     * The board under everything: the printed score ring, its corners and the frame round the map and
     * the guild panels when the folder holds it, else a plain frame for the drawn ring to sit on. The
     * map and the panels lie over it in their own rects.
     */
</script>

<PieceFrame
    label="The board's edge"
    url={assetUrl(RingAsset)}
    width={BoardWidth}
    height={BoardHeight}
    viewBox="0 0 {BoardWidth} {BoardHeight}"
>
    <rect width={BoardWidth} height={BoardHeight} fill="var(--feudum-board-frame)"></rect>
</PieceFrame>
