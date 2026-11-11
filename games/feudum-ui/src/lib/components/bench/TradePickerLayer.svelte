<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { ActionBlock } from '$lib/model/actionPanel.js'
    import { colourPaint, seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TradePicker from './TradePicker.svelte'

    /** The trade picker on the displayed state, with the session's presses. */
    let {
        block,
        compact = false
    }: { block: Extract<ActionBlock, { kind: 'trade-picker' }>; compact?: boolean } = $props()

    const gameSession = getGameSession()

    function paintOf(playerId: string) {
        return seatPaint(gameSession.colors, playerId, gameSession.getPlayerName(playerId))
    }

    function colourPaintOf(colour: Color) {
        return colourPaint(gameSession.colors, colour)
    }
</script>

<TradePicker
    bench={block.bench}
    {compact}
    other={block.other}
    send={block.send}
    state={gameSession.gameState}
    playerId={gameSession.myPlayerId ?? ''}
    {paintOf}
    {colourPaintOf}
    pointer={gameSession}
    onPress={(choice) => void gameSession.pressTurnChoice(choice)}
/>
