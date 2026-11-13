<script lang="ts">
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import GuildStandings from './GuildStandings.svelte'

    /** The guild standings of the state the session shows, in each seat's paint (S71). */
    const gameSession = getGameSession()
    let view = $derived(
        guildStandingsOf(gameSession.gameState, (playerId) => gameSession.getPlayerName(playerId))
    )

    const { paintOf } = gameSession
</script>

<GuildStandings {view} {paintOf} />
