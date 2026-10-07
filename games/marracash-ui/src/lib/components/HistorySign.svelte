<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ElMessiriCapHeight } from '$lib/utils/playerPanel.js'
    import { playerStandeeOutline, signInitial } from '$lib/utils/shopSign.js'

    const InitialSize = 22
    const InitialCenterY = -24

    let { playerId, height }: { playerId: string; height: number } = $props()
    const gameSession = getGameSession()

    let fill = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
</script>

<svg
    class="history-sign"
    width={(height * 44) / 54}
    {height}
    viewBox="-22 -58 44 54"
    aria-hidden="true"
>
    <path
        d={playerStandeeOutline(gameSession.gameState.players, playerId)}
        {fill}
        style:stroke="color-mix(in srgb, {fill} 55%, #000000)"
        stroke-width="2.4"
        stroke-linejoin="round"
    ></path>
    <text
        x="0"
        y={InitialCenterY + (ElMessiriCapHeight * InitialSize) / 2}
        text-anchor="middle"
        class="marracash-merchant"
        font-size={InitialSize}
        fill={gameSession.colors.getPlayerTextColorValue(playerId)}
        >{signInitial(gameSession.getPlayerName(playerId))}</text
    >
</svg>

<style>
    .history-sign {
        flex: none;
        filter: drop-shadow(0 1px 0 rgb(0 0 0 / 0.25));
    }
</style>
