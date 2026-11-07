<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * A seat's name in the log, for the eyes the log is reading with. The shared name follows the
     * session's own seat, which in a hotseat moves on as a replay steps through other seats' Actions.
     */
    let {
        playerId,
        viewerId,
        possessive = false
    }: { playerId: string; viewerId: string | undefined; possessive?: boolean } = $props()

    const gameSession = getGameSession()

    let own = $derived(playerId === viewerId)
    let name = $derived(own ? 'you' : gameSession.getPlayerName(playerId))
    let suffix = $derived(possessive ? (own ? 'r' : "'s") : '')
</script>

<span
    style:background-color={gameSession.colors.getPlayerBgColorValue(playerId)}
    style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
    class="rounded px-2 font-medium"><span class="capitalize">{name}</span>{suffix}</span
>
