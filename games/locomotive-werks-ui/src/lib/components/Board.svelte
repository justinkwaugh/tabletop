<script lang="ts">
    import paper from '$lib/images/paper.webp'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ShipmentDiceAnimator } from '$lib/animators/shipmentDice.js'
    import { BOARD_WIDTH, HEADER_HEIGHT, ROWS_HEIGHT } from '$lib/utils/boardLayout.js'
    import BoardHeader from './board/BoardHeader.svelte'
    import LocomotiveRow from './board/LocomotiveRow.svelte'
    import DevelopPicker from './pickers/DevelopPicker.svelte'
    import WerkPicker from './pickers/WerkPicker.svelte'

    const gameSession = getGameSession()

    const PAPER_TILE = 160

    function animateShipments(board: SVGSVGElement) {
        const animator = new ShipmentDiceAnimator(gameSession, board)
        animator.register()
        return () => animator.unregister()
    }
</script>

<!-- The board is as wide as the column. Its rows scroll under the banner, which stays put like a
     frozen row, so the column labels are always in view. -->
<div class="board" role="group" aria-label="The Locomotive Werks board">
    <svg
        class="banner"
        width={BOARD_WIDTH}
        height={HEADER_HEIGHT}
        viewBox="0 0 {BOARD_WIDTH} {HEADER_HEIGHT}"
        aria-hidden="true"
    >
        <BoardHeader />
    </svg>
    <svg
        class="rows"
        width={BOARD_WIDTH}
        height={ROWS_HEIGHT}
        viewBox="0 0 {BOARD_WIDTH} {ROWS_HEIGHT}"
        {@attach animateShipments}
    >
        <defs>
            <pattern
                id="lw-paper"
                patternUnits="userSpaceOnUse"
                width={PAPER_TILE}
                height={PAPER_TILE}
            >
                <image href={paper} width={PAPER_TILE} height={PAPER_TILE}></image>
            </pattern>
        </defs>
        <rect width={BOARD_WIDTH} height={ROWS_HEIGHT} fill="url(#lw-paper)"></rect>
        {#each gameSession.boardState.spaces as space, index (space.locomotiveId)}
            <LocomotiveRow {space} {index} />
        {/each}
    </svg>
    <DevelopPicker />
    <WerkPicker />
</div>

<style>
    .board {
        margin: 0 auto;
        max-width: 1700px;
        user-select: none;
    }

    svg {
        display: block;
        width: 100%;
        height: auto;
    }

    .banner {
        position: sticky;
        top: 0;
        z-index: 1;
    }
</style>
