<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { BenchOffer } from '$lib/model/benchOffer.js'
    import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Bench from './Bench.svelte'

    /** The bench of this seat's staged function, on the displayed state, with the session's presses. */
    let { bench }: { bench: BenchOffer } = $props()

    const gameSession = getGameSession()

    function paintOf(playerId: string) {
        const initial = gameSession.getPlayerName(playerId).charAt(0).toUpperCase()
        return seatPaint(gameSession.colors, playerId, initial)
    }

    function colourPaintOf(colour: Color) {
        return colourPaint(gameSession.colors, colour)
    }
</script>

<Bench
    {bench}
    state={gameSession.gameState}
    playerId={gameSession.myPlayerId ?? ''}
    {paintOf}
    {colourPaintOf}
    pointer={gameSession}
    onPress={(choice) => void gameSession.pressTurnChoice(choice)}
/>
