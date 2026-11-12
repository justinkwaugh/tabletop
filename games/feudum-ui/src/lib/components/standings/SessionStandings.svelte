<script lang="ts">
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import GuildStandings from './GuildStandings.svelte'

    /** The guild standings of the state the session shows, in each seat's paint (S71). */
    let { sheet = false }: { sheet?: boolean } = $props()

    const gameSession = getGameSession()
    let view = $derived(
        guildStandingsOf(gameSession.gameState, (playerId) => gameSession.getPlayerName(playerId))
    )

    function paintOf(playerId: string) {
        return seatPaint(gameSession.colors, playerId, gameSession.getPlayerName(playerId))
    }
</script>

<GuildStandings {view} {paintOf} {sheet} />
