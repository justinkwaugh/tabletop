<script lang="ts">
    import SignFace from '$lib/components/SignFace.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ElMessiriCapHeight, PanelPalette } from '$lib/utils/playerPanel.js'
    import {
        playerStandeeOutline,
        SignFaceCenterY,
        signInitial,
        SignTopOrnament
    } from '$lib/utils/shopSign.js'

    const InitialSize = 27

    let { playerId, name }: { playerId: string; name: string } = $props()
    const gameSession = getGameSession()

    let outline = $derived(playerStandeeOutline(gameSession.gameState.players, playerId))
</script>

<svg class="sign" width="58" height="72" viewBox="-23 -58 46 56" aria-hidden="true">
    <SignFace
        {outline}
        fill={gameSession.colors.getPlayerBgColorValue(playerId)}
        edge={PanelPalette.brass}
        edgeWidth={1.75}
        ornaments={[SignTopOrnament]}
    >
        <text
            x="0"
            y={SignFaceCenterY + (ElMessiriCapHeight * InitialSize) / 2}
            text-anchor="middle"
            class="marracash-merchant"
            font-size={InitialSize}
            fill={gameSession.colors.getPlayerTextColorValue(playerId)}>{signInitial(name)}</text
        >
    </SignFace>
</svg>

<style>
    .sign {
        filter: drop-shadow(1px 2px 1.5px rgb(0 0 0 / 0.5));
    }
</style>
