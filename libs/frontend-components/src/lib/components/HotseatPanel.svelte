<script lang="ts">
    import { getContext } from 'svelte'
    import type { GameSession } from '../model/gameSession.svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>
    let hotseatPlayerBgColor = $derived(
        gameSession.colors.getPlayerBgColor(gameSession.myPlayer?.id)
    )
    let hotseatPlayerTextColor = $derived(
        gameSession.colors.getPlayerTextColor(gameSession.myPlayer?.id)
    )
</script>

{#if gameSession.myPlayer}
    <div
        class=" {hotseatPlayerBgColor} {hotseatPlayerTextColor} shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-center items-center text-lg"
    >
        <span class="font-bold">{gameSession.myPlayer?.name}</span>&nbsp;- It's your turn
    </div>
{/if}
