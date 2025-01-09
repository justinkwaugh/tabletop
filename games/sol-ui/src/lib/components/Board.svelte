<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import Sandbox from './Sandbox.svelte'
    import Mothership from './Mothership.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    const boardImage = gameSession.numPlayers === 5 ? boardImg5p : boardImg
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImage} alt="game board" />
    </div>
    <svg class="absolute z-10" width="1280" height="1280" viewBox="0 0 1280 1280">
        <defs>
            <DropShadow id="textshadow" />
            <DropShadow id="divershadow" offset={{ x: 0, y: 0 }} amount={20} />
        </defs>

        {#each gameSession.gameState.board as cell}
            <Cell {cell} />
        {/each}

        {#each gameSession.gameState.players as player}
            <Mothership playerId={player.playerId} />
        {/each}

        <!-- <Sandbox /> -->
    </svg>
</div>
