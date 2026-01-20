<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()
    const { myPlayer, colors } = gameSession.bridge
    let hotseatPlayerBgColor = $derived(
        $colors.getPlayerBgColor($myPlayer?.id)
    )
    let hotseatPlayerTextColor = $derived(
        $colors.getPlayerTextColor($myPlayer?.id)
    )
</script>

{#if $myPlayer}
    <div
        class=" {hotseatPlayerBgColor} {hotseatPlayerTextColor} shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-center items-center text-lg"
    >
        <span class="font-bold">{$myPlayer?.name}</span>&nbsp;- It's your turn
    </div>
{/if}
