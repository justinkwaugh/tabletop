<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'

    let { playerId }: { playerId?: string } = $props()

    let gameSession = getContext('gameSession') as KaivaiGameSession
</script>

<span
    class="rounded px-2 {gameSession.getPlayerBgColor(
        playerId
    )} font-medium {gameSession.getPlayerTextColor(playerId)}"
    >{gameSession.getPlayerName(playerId)}</span
>
