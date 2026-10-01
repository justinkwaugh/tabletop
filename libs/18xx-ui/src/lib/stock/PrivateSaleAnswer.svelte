<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, disabled }: { session: EighteenXXSession; disabled: boolean } = $props()
    const money = $derived(session.presentation.money)
    const offer = $derived(session.stock.privateSaleOffer)
</script>

{#if offer}
    {@const name = getCompany(session.gameState, offer.privateCompanyId).name}
    <section class="private-answer" aria-label="Private purchase offer">
        <p>
            {session.getPlayerName(offer.buyerPlayerId)} offers {money(offer.price)} for {name}.
        </p>
        {#if offer.sellerPlayerId === session.myPlayer?.id}
            <div class="choices">
                <button {disabled} onclick={() => void session.stock.answerPrivatePurchase(true)}
                    >Sell for {money(offer.price)}</button
                >
                <button {disabled} onclick={() => void session.stock.answerPrivatePurchase(false)}
                    >Decline</button
                >
            </div>
        {:else}
            <p>Waiting for {session.getPlayerName(offer.sellerPlayerId)} to answer.</p>
        {/if}
    </section>
{/if}

<style>
    .private-answer {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    .choices {
        display: flex;
        gap: 10px;
        justify-content: center;
    }
    button {
        font: inherit;
        font-weight: 400;
        color: inherit;
        background: var(--rail-surface-raised, #efe7db);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
