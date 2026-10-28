<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A player's chip by name in their colour; the viewer's too, where the words around it say "your".
    let { playerId }: { playerId: string } = $props()

    let gameSession = getGameSession()
</script>

<span
    class="rounded px-1.5 font-medium capitalize"
    style:background-color={gameSession.colors.getPlayerBgColorValue(playerId)}
    style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
    >{gameSession.getPlayerName(playerId)}</span
>
