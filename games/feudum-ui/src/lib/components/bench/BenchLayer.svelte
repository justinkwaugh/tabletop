<script lang="ts">
    import type { BenchOffer } from '$lib/model/benchOffer.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Bench from './Bench.svelte'
    import TradePickerLayer from './TradePickerLayer.svelte'

    let { bench }: { bench: BenchOffer } = $props()

    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    /** Contract, The bench: on a phone the send stands in the sheet's footer. */
    let primary = $derived(
        phone.phone
            ? gameSession.actionPanel.blocks.find((block) => block.kind === 'primary')
            : undefined
    )

    /** R-4.6 The staged moves: in the tray on a desk, above the send in this sheet on a phone. */
    let staged = $derived(
        phone.phone
            ? gameSession.actionPanel.blocks.find((block) => block.kind === 'staged')
            : undefined
    )

    /** Contract, The trade picker: in the tray on a desk, in this sheet on a phone. */
    let picker = $derived(
        gameSession.actionPanel.blocks.find((block) => block.kind === 'trade-picker')
    )

    const { paintOf, colourPaintOf } = gameSession
</script>

{#snippet sheetPicker()}
    {#if picker?.kind === 'trade-picker'}
        <TradePickerLayer block={picker} compact />
    {/if}
{/snippet}

{#if !picker || phone.phone}
    <Bench
        {bench}
        picker={picker ? sheetPicker : undefined}
        sheet={phone.phone}
        primary={primary?.kind === 'primary' ? primary : undefined}
        staged={staged?.kind === 'staged' ? staged : undefined}
        state={gameSession.gameState}
        playerId={gameSession.myPlayerId ?? ''}
        {paintOf}
        {colourPaintOf}
        pointer={gameSession}
        onPress={(choice) => void gameSession.pressTurnChoice(choice)}
    />
{/if}
