<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()
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
