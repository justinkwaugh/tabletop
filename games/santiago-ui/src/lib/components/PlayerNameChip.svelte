<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        playerId,
        possessive = false,
        uppercase = false
    }: { playerId?: string; possessive?: boolean; uppercase?: boolean } = $props()

    const session = getGameSession()
</script>

<span class="rounded px-2 font-medium {uppercase ? 'uppercase' : 'capitalize'}"
    style:background-color={session.colors.getPlayerBgColorValue(playerId)}
    style:color={session.colors.getPlayerTextColorValue(playerId)}>
    {session.getPlayerName(playerId)}{possessive ? "'s" : ''}
</span>
