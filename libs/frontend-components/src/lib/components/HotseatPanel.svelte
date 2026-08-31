<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import ActingPlayerControl from './ActingPlayerControl.svelte'

    let gameSession = getGameSession()
    const { myPlayer, colors } = gameSession.bridge
    let hotseatPlayerBgColor = $derived($colors.getPlayerBgColorValue($myPlayer?.id))
    let hotseatPlayerTextColor = $derived($colors.getPlayerTextColorValue($myPlayer?.id))
    let showActingPlayerControl = $derived(
        gameSession.isActingAdmin && !gameSession.isViewingAsNonActivePlayer
    )
</script>

{#if $myPlayer || showActingPlayerControl}
    <div
        class="shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-center items-center text-lg"
        style:background-color={hotseatPlayerBgColor}
        style:color={hotseatPlayerTextColor}
    >
        {#if gameSession.isViewingAsNonActivePlayer && $myPlayer}
            Viewing as&nbsp;<span class="font-bold">{$myPlayer.name}</span>&nbsp;- Waiting for
            active player
        {:else if showActingPlayerControl}
            <ActingPlayerControl />
        {:else if $myPlayer}
            <span class="font-bold">{$myPlayer.name}</span>&nbsp;- It's your turn
        {/if}
    </div>
{/if}
