<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import Sandbox from './Sandbox.svelte'
    import Mothership from './Mothership.svelte'
    import type { Sundiver } from '@tabletop/sol'
    import UISundiver from './Sundiver.svelte'
    import { SundiverAnimator } from '$lib/animators/sundiverAnimator.js'

    let gameSession = getContext('gameSession') as SolGameSession
    const boardImage = gameSession.numPlayers === 5 ? boardImg5p : boardImg

    // Non-reactive map of sundivers by ID for rendering sundiver movement
    const sundiversById: Map<string, Sundiver> = new Map()
    for (const diver of gameSession.gameState.getAllSundivers()) {
        sundiversById.set(diver.id, diver)
    }
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

        {#each [...sundiversById] as [, sundiver] (sundiver.id)}
            <UISundiver
                color={gameSession.colors.getPlayerColor(sundiver.playerId)}
                animator={new SundiverAnimator(gameSession, sundiver.id)}
            />
        {/each}

        {#each gameSession.gameState.board as cell}
            <Cell {cell} />
        {/each}

        {#each gameSession.gameState.players as player}
            <Mothership playerId={player.playerId} />
        {/each}

        <!-- <Sandbox /> -->
    </svg>
</div>
