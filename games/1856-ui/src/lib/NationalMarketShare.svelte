<script lang="ts">
    import { TitlePrompt } from '@tabletop/18xx-ui'
    import type { Session1856 } from './session.svelte.js'
    let { session, owed }: { session: Session1856; owed: { price: number; short: number } } =
        $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<TitlePrompt
    text={owed.short
        ? `The open market holds more than half the CGR’s shares. As a CGR shareholder, buy one of them this turn. You are ${money(owed.short)} short: sell shares first, or buy now and sell what you must; a player who cannot raise it is bankrupt.`
        : 'The open market holds more than half the CGR’s shares. As a CGR shareholder, buy one of them this turn; you may sell other shares first.'}
>
    <button
        class="action-button inline-action"
        disabled={busy}
        onclick={() => session.buyNationalMarketShare(owed.price)}
        >Buy for {money(owed.price)}</button
    >
</TitlePrompt>
