<script lang="ts">
    import PrivateCard from '../privates/PrivateCard.svelte'
    import { getCompany } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, showEntry = true }: { session: FinanceExampleSession; showEntry?: boolean } = $props()
    const mine = $derived(session.privatePurchases.filter((option) => option.request.seller.kind === 'player' && option.request.seller.playerId === session.myPlayer?.id))
    const others = $derived(session.privatePurchases.filter((option) => !mine.includes(option)))
    const source = $derived(session.privatePurchaseSource)
    const choices = $derived(source === 'mine' ? mine : others)
    const draft = $derived(session.companyDecisionSelection)
</script>

{#if (showEntry || source) && (session.privatePurchases.length || (draft?.kind === 'purchase' && draft.request.asset.kind === 'private'))}
<section aria-label="Buy privates">
    {#if !source}
        <button onclick={() => session.choosePrivatePurchaseSource(mine.length ? 'mine' : 'other')}>Buy privates</button>
    {:else}
        {#if session.privatePurchaseHeading && !(draft?.kind === 'purchase' && draft.request.asset.kind === 'private')}
            <p class="prompt">{session.privatePurchaseHeading}</p>
        {/if}
        {#if mine.length && others.length}
        <div class="sources">
            {#if mine.length}<button aria-pressed={source === 'mine'} onclick={() => session.choosePrivatePurchaseSource('mine')}>Mine</button>{/if}
            <span class="source-divider" aria-hidden="true"></span>
            {#if others.length}<button aria-pressed={source === 'other'} onclick={() => session.choosePrivatePurchaseSource('other')}>Other players’</button>{/if}
        </div>
        {/if}
        {#if draft?.kind === 'purchase' && draft.request.asset.kind === 'private'}
            {@const company = getCompany(session.financialState, draft.request.asset.privateCompanyId)}
            {@const terms = session.privatePurchases.find((option) => option.request.asset.kind === 'private' && option.request.asset.privateCompanyId === company.id)}
            <div class="selected-private">
                <PrivateCard token={session.privateCompanyTokens[company.id]} name={company.name} description="" income={company.privateRevenue ?? 0}
                    purchaseRange={terms ? { minimum: terms.minimum, maximum: terms.maximum } : undefined} />
                {#if source === 'other'}<small class="seller">owned by {session.ownerName(draft.request.seller)}</small>{/if}
            </div>
            <div class="price">
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
                            <PrivateCard token={session.privateCompanyTokens[company.id]} name={company.name} description="" income={company.privateRevenue ?? 0}
                                purchaseRange={{ minimum: option.minimum, maximum: option.maximum }} />
                            {#if source === 'other'}<small class="seller">owned by {session.ownerName(option.request.seller)}</small>{/if}
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
    .sources, .price { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; }
    .privates { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 260px)); justify-content: center; gap: 8px; }
    .privates :global(.private-card) { flex: 1; }
    .privates :global(.private-card header) { height: 100%; box-sizing: border-box; }
    .sources { margin-bottom: 8px; }
    .selected-private { width: min(100%, 260px); margin: 0 auto 8px; }
    button { font: inherit; font-weight: 400; color: inherit; background: #efe7db; border: 1px solid #c7b8a6; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
    .sources button { border: none; background: transparent; }
    .sources button[aria-pressed='true'] { background: #dfd3c8; color: #443c34; font-weight: 600; }
    .source-divider { height: 13px; border-left: 1px solid #b7a58f; }
    button.private { display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; background: transparent; text-align: left; }
    button.private > :global(*) { width: 100%; box-sizing: border-box; }
    button.private:hover { filter: brightness(.96); }
    button.private:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
    .seller { display: block; margin-top: 3px; text-align: right; }
    small { font-size: 11px; color: #887969; }
    input { width: 76px; font: inherit; padding: 4px; border: 1px solid #b8a995; border-radius: 3px; }
    .commit { background: #443c34; color: #faf7f2; border: none; }
    button:disabled { opacity: .5; cursor: default; }
    p { text-align: center; }
    .prompt { margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #63513e; }
</style>
