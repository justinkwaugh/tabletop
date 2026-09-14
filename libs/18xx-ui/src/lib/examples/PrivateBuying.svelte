<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const mine = $derived(session.privatePurchases.filter((option) => option.request.seller.kind === 'player' && option.request.seller.playerId === session.myPlayer?.id))
    const others = $derived(session.privatePurchases.filter((option) => !mine.includes(option)))
    const source = $derived(session.privatePurchaseSource)
    const choices = $derived(source === 'mine' ? mine : others)
    const draft = $derived(session.companyDecisionSelection)
</script>

{#if session.privatePurchases.length || (draft?.kind === 'purchase' && draft.request.asset.kind === 'private')}
<section aria-label="Buy privates">
    {#if !source}
        <button onclick={() => session.choosePrivatePurchaseSource(mine.length ? 'mine' : 'other')}>Buy privates</button>
    {:else}
        {#if !(draft?.kind === 'purchase' && draft.request.asset.kind === 'private')}
            <p class="prompt">Choose a private to purchase</p>
        {/if}
        {#if mine.length && others.length}
        <div class="sources">
            {#if mine.length}<button class:chosen={source === 'mine'} onclick={() => session.choosePrivatePurchaseSource('mine')}>Your privates</button>{/if}
            {#if others.length}<button class:chosen={source === 'other'} onclick={() => session.choosePrivatePurchaseSource('other')}>Other players</button>{/if}
        </div>
        {/if}
        {#if draft?.kind === 'purchase' && draft.request.asset.kind === 'private'}
            {@const company = getCompany(session.financialState, draft.request.asset.privateCompanyId)}
            {@const terms = session.privatePurchases.find((option) => option.request.asset.kind === 'private' && option.request.asset.privateCompanyId === company.id)}
            <div class="price">
                <span>{company.name}</span>
                <label>Price $<input aria-label="Private purchase price" type="number" min={terms?.minimum} max={terms?.maximum} step="1" value={draft.request.price} oninput={(event) => session.setPurchasePrice(event.currentTarget.valueAsNumber)} /></label>
                <button class="commit" disabled={!session.canResolveCompanyDecision || !!session.purchaseOfferEvaluation?.reason} onclick={() => session.confirmCompanyDecision()}>{session.purchaseOfferEvaluation?.buyerPlayerId === session.purchaseOfferEvaluation?.sellerPlayerId ? 'Buy' : 'Offer'}</button>
            </div>
            {#if session.purchaseOfferEvaluation?.reason}<p>{session.purchaseOfferEvaluation.reason}</p>{/if}
        {:else}
            <div class="privates">
                {#each choices as option}
                    {#if option.request.asset.kind === 'private'}
                        {@const company = getCompany(session.financialState, option.request.asset.privateCompanyId)}
                        <button class="private" onclick={() => session.selectPurchaseOffer(option.request)}>
                            <span>{company.name}</span>
                            {#if source === 'other'}<small>{session.ownerName(option.request.seller)}</small>{/if}
                            <span class="values"><small>Income ${company.privateRevenue ?? 0}</small><span>${option.minimum}–${option.maximum}</span></span>
                        </button>
                    {/if}
                {/each}
            </div>
        {/if}
    {/if}
</section>
{/if}
<style>
    section { padding: 4px 0; color: #514536; font-size: 13px; }
    .sources, .privates, .price { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; }
    .sources { margin-bottom: 8px; }
    button { font: inherit; font-weight: 400; color: inherit; background: #efe7db; border: 1px solid #c7b8a6; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
    .sources button { border: none; background: transparent; }
    .sources .chosen { background: #dfd3c8; }
    .private { display: flex; flex-direction: column; gap: 5px; min-width: 180px; text-align: left; }
    .values { display: flex; justify-content: space-between; gap: 18px; width: 100%; }
    small { font-size: 11px; color: #887969; }
    input { width: 76px; font: inherit; padding: 4px; border: 1px solid #b8a995; border-radius: 3px; }
    .commit { background: #443c34; color: #faf7f2; border: none; }
    button:disabled { opacity: .5; cursor: default; }
    p { text-align: center; }
    .prompt { margin: 0 0 6px; }
</style>
