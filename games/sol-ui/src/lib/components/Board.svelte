<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import Mothership from './Mothership.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import { SolGraph } from '@tabletop/sol'
    import Sandbox from './Sandbox.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    const graph = new SolGraph(5) //(gameSession.numPlayers)
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImg5p} alt="game board" />
    </div>
    <svg class="absolute z-10" width="1280" height="1280" viewBox="0 0 1280 1280">
        <defs>
            <DropShadow id="textshadow" />
            <DropShadow id="divershadow" offset={{ x: 0, y: 0 }} amount={20} />
        </defs>

        {#each graph as node}
            <Cell coords={node.coords} />
        {/each}
        <!-- 
        {#each gameSession.gameState.players as player}
            <Mothership playerId={player.playerId} />
        {/each} -->

        <Sandbox />
    </svg>
</div>
