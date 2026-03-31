<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()
    const { myPlayer, colors } = gameSession.bridge
    let hotseatPlayerBgColor = $derived($colors.getPlayerBgColorValue($myPlayer?.id))
    let hotseatPlayerTextColor = $derived($colors.getPlayerTextColorValue($myPlayer?.id))
</script>

{#if $myPlayer}
    <div
        class="shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-center items-center text-lg"
        style:background-color={hotseatPlayerBgColor}
        style:color={hotseatPlayerTextColor}
    >
        <span class="font-bold">{$myPlayer?.name}</span>&nbsp;- It's your turn
    </div>
{/if}
