<script lang="ts">
    import type { BenchOffer } from '$lib/model/benchOffer.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Bench from './Bench.svelte'
    import TradePickerLayer from './TradePickerLayer.svelte'

    /** The bench of this seat's staged function, on the displayed state, with the session's presses. */
    let { bench }: { bench: BenchOffer } = $props()

    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    /** Contract, The bench: on a phone the send stands in the sheet's footer. */
    let primary = $derived(
        phone.phone
            ? gameSession.actionPanel.blocks.find((block) => block.kind === 'primary')
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
        state={gameSession.gameState}
        playerId={gameSession.myPlayerId ?? ''}
        {paintOf}
        {colourPaintOf}
        pointer={gameSession}
        onPress={(choice) => void gameSession.pressTurnChoice(choice)}
    />
{/if}
