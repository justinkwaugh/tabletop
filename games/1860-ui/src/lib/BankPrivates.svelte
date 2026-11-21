<script lang="ts">
    import { FishbourneId, PrivateCatalog1860 } from '@tabletop/1860'
    import type { Session1860 } from './session.svelte.js'
    let { session }: { session: Session1860 } = $props()
    const money = $derived(session.presentation.money)
    const name = (privateCompanyId: string) => session.companyName(privateCompanyId)
</script>

<section class="centered-panel bank-privates" aria-label="Privates with the bank">
    {#if session.privateSales.length}
        <h3>Sell a private to the bank</h3>
        <p class="note">
            The bank pays face value less £30, and offers it for sale again at face value. Sell
            before you buy.
        </p>
        <div class="choices">
            {#each session.privateSales as offer (offer.privateCompanyId)}
                <button
                    class="action-button"
                    disabled={!session.canChooseAction}
                    onclick={() => session.sellPrivateToBank(offer.privateCompanyId)}
                    >Sell {name(offer.privateCompanyId)} for {money(offer.amount)}</button
                >
            {/each}
        </div>
    {/if}
    {#if session.privatePurchases.length}
        <h3>Buy a private from the bank</h3>
        <p class="note">At face value, as your purchase this turn.</p>
        <div class="choices">
            {#each session.privatePurchases as offer (offer.privateCompanyId)}
                <button
                    class="action-button"
                    disabled={!session.canChooseAction}
                    onclick={() => session.buyPrivateFromBank(offer.privateCompanyId)}
                    >Buy {name(offer.privateCompanyId)} for {money(offer.amount)}</button
                >
            {/each}
        </div>
        {#if session.privatePurchases.some((offer) => offer.privateCompanyId === FishbourneId)}
            <p class="note">
                {PrivateCatalog1860.definition(FishbourneId).description}
            </p>
        {/if}
    {/if}
</section>

<style>
    .action-button {
        margin: 0;
        padding: 5px 14px;
        border-radius: 4px;
        cursor: pointer;
    }
    .action-button:disabled {
        cursor: default;
    }
    .bank-privates {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    h3 {
        margin: 0;
        font-size: 14px;
    }
    .note {
        margin: 0;
        max-width: 34em;
        text-align: center;
        font-size: 12px;
        color: var(--rail-muted, #786550);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
