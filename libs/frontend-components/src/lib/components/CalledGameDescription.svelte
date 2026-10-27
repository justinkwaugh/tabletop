<script lang="ts">
    import {
        assertExists,
        gameCallDescription,
        gameCallOf,
        type GameAction
    } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let { action }: { action: GameAction } = $props()

    const gameSession = getGameSession()
    const description = $derived.by(() => {
        const call = gameCallOf(action)
        assertExists(call, 'A called game description needs a callGame Action')
        return gameCallDescription(call, (playerId) => gameSession.getPlayerName(playerId))
    })
</script>

{description}.
