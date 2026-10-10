<script lang="ts">
    import ReefBoard from './ReefBoard.svelte'
    import OpenSea from './OpenSea.svelte'
    import type { BoardRotation } from '$lib/utils/artGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    type Side = 'bottom' | 'left' | 'top' | 'right'

    // As at the table: the open sea in the middle and each board turned to face its side.
    const SidesByBoardCount: Record<number, readonly Side[]> = {
        2: ['bottom', 'top'],
        3: ['bottom', 'left', 'right'],
        4: ['bottom', 'left', 'top', 'right']
    }
    const Rotation: Record<Side, BoardRotation> = { bottom: 0, left: 90, top: 180, right: 270 }

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const placed = $derived(
        state.reefs.map((reef, index) => ({
            reef,
            side: SidesByBoardCount[state.reefs.length][index]
        }))
    )
</script>

<div class="table">
    <div class="sea"><OpenSea /></div>
    {#each placed as { reef, side } (reef.boardId)}
        <div class={side}>
            <ReefBoard
                {reef}
                rotation={Rotation[side]}
                shrimps={state.shrimps.filter((shrimp) => shrimp.boardId === reef.boardId)}
            />
        </div>
    {/each}
</div>

<style>
    .table {
        display: grid;
        grid-template-areas:
            '. top .'
            'left sea right'
            '. bottom .';
        place-items: center;
        gap: 16px;
        padding: 24px;
    }

    .sea {
        grid-area: sea;
    }

    .top {
        grid-area: top;
    }

    .left {
        grid-area: left;
    }

    .right {
        grid-area: right;
    }

    .bottom {
        grid-area: bottom;
    }
</style>
