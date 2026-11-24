<script lang="ts">
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import GuildStandings from './GuildStandings.svelte'

    /** S71 In each seat's paint. */
    const gameSession = getGameSession()
    let view = $derived(
        guildStandingsOf(gameSession.gameState, (playerId) => gameSession.getPlayerName(playerId))
    )

    const { paintOf } = gameSession
</script>

<GuildStandings {view} {paintOf} />
