<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        playerId,
        viewerId,
        possessive = false
    }: { playerId: string; viewerId: string | undefined; possessive?: boolean } = $props()

    const gameSession = getGameSession()

    let own = $derived(playerId === viewerId)
    let name = $derived(own ? 'You' : gameSession.getPlayerName(playerId))
    let suffix = $derived(possessive ? (own ? 'r' : "'s") : '')
</script>

<span
    style:background-color={gameSession.colors.getPlayerBgColorValue(playerId)}
    style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
    class="rounded px-2 font-medium">{name}{suffix}</span
>
