<script lang="ts">
    import type { ActionBlock } from '$lib/model/actionPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TradePicker from './TradePicker.svelte'

    let {
        block,
        compact = false
    }: { block: Extract<ActionBlock, { kind: 'trade-picker' }>; compact?: boolean } = $props()

    const gameSession = getGameSession()

    const { paintOf, colourPaintOf } = gameSession
</script>

<TradePicker
    bench={block.bench}
    {compact}
    send={block.send}
    state={gameSession.gameState}
    playerId={gameSession.myPlayerId ?? ''}
    {paintOf}
    {colourPaintOf}
    pointer={gameSession}
    onPress={(choice) => void gameSession.pressTurnChoice(choice)}
/>
