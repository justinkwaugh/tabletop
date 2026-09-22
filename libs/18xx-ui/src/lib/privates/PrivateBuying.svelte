<script lang="ts">
    import PrivateCard from './PrivateCard.svelte'
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, showEntry = true }: { session: EighteenXXSession; showEntry?: boolean } =
        $props()
    const money = $derived(session.presentation.money)
    const mine = $derived(
        session.decisions.privatePurchases.filter(
            (option) =>
                option.request.seller.kind === 'player' &&
                option.request.seller.playerId === session.myPlayer?.id
        )
    )
    const others = $derived(
        session.decisions.privatePurchases.filter((option) => !mine.includes(option))
    )
    const source = $derived(session.privateActions.purchaseSource)
    const choices = $derived(source === 'mine' ? mine : others)
    const selection = $derived(session.decisions.selection)
</script>

{#if (showEntry || source) && (session.decisions.privatePurchases.length || (selection?.kind === 'purchase' && selection.request.asset.kind === 'private'))}
    <section aria-label="Buy privates">
        {#if !source}
            <button
                onclick={() =>
                    session.privateActions.choosePurchaseSource(mine.length ? 'mine' : 'other')}
                >Buy privates</button
            >
        {:else}
            {#if session.presentation.privatePurchaseHeading && !(selection?.kind === 'purchase' && selection.request.asset.kind === 'private')}
                <p class="prompt">{session.presentation.privatePurchaseHeading}</p>
            {/if}
            {#if mine.length && others.length}
                <div class="sources">
                    {#if mine.length}<button
                            aria-pressed={source === 'mine'}
                            onclick={() => session.privateActions.choosePurchaseSource('mine')}
                            >Mine</button
                        >{/if}
                    <span class="source-divider" aria-hidden="true"></span>
                    {#if others.length}<button
                            aria-pressed={source === 'other'}
                            onclick={() => session.privateActions.choosePurchaseSource('other')}
                            >Other players’</button
                        >{/if}
                </div>
            {/if}
            {#if selection?.kind === 'purchase' && selection.request.asset.kind === 'private'}
                {@const company = getCompany(
                    session.gameState,
                    selection.request.asset.privateCompanyId
                )}
                {@const terms = session.decisions.privatePurchases.find(
                    (option) =>
                        option.request.asset.kind === 'private' &&
                        option.request.asset.privateCompanyId === company.id
                )}
                <div class="selected-private">
                    <PrivateCard
                        {money}
                        phaseColors={session.presentation.phaseColors}
                        token={session.privateCompanyTokens[company.id]}
                        name={company.name}
                        description=""
                        income={company.privateRevenue ?? 0}
                        purchaseRange={terms
                            ? { minimum: terms.minimum, maximum: terms.maximum }
                            : undefined}
                    />
                    {#if source === 'other'}<small class="seller"
                            >owned by {session.ownerName(selection.request.seller)}</small
                        >{/if}
                </div>
                <div class="price">
                    <label
                        >Price $<input
                            aria-label="Private purchase price"
                            type="number"
                            min={terms?.minimum}
                            max={terms?.maximum}
                            step="1"
                            value={selection.request.price}
                            oninput={(event) =>
                                session.decisions.setPurchasePrice(
                                    event.currentTarget.valueAsNumber
                                )}
                        /></label
                    >
                    <button
                        class="commit"
                        disabled={!session.decisions.canResolve ||
                            !!session.decisions.purchaseOfferEvaluation?.reason}
                        onclick={() => session.decisions.confirm()}
                        >{session.decisions.purchaseOfferEvaluation?.buyerPlayerId ===
                        session.decisions.purchaseOfferEvaluation?.sellerPlayerId
                            ? 'Buy'
                            : 'Offer'}</button
                    >
                </div>
                {#if session.decisions.purchaseOfferEvaluation?.reason}<p>
                        {session.decisions.purchaseOfferEvaluation.reason}
                    </p>{/if}
            {:else}
                <div class="privates">
                    {#each choices as option}
                        {#if option.request.asset.kind === 'private'}
                            {@const company = getCompany(
                                session.gameState,
                                option.request.asset.privateCompanyId
                            )}
                            <button
                                class="private"
                                onclick={() =>
                                    session.decisions.selectPurchaseOffer(option.request)}
                            >
                                <PrivateCard
                                    {money}
                                    phaseColors={session.presentation.phaseColors}
                                    token={session.privateCompanyTokens[company.id]}
                                    name={company.name}
                                    description=""
                                    income={company.privateRevenue ?? 0}
                                    purchaseRange={{
                                        minimum: option.minimum,
                                        maximum: option.maximum
                                    }}
                                />
                                {#if source === 'other'}<small class="seller"
                                        >owned by {session.ownerName(option.request.seller)}</small
                                    >{/if}
                            </button>
                        {/if}
                    {/each}
                </div>
            {/if}
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    .sources,
    .price {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .privates {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 260px));
        justify-content: center;
        gap: 8px;
    }
    .privates :global(.private-card) {
        flex: 1;
    }
    .privates :global(.private-card header) {
        height: 100%;
        box-sizing: border-box;
    }
    .sources {
        margin-bottom: 8px;
    }
    .selected-private {
        width: min(100%, 260px);
        margin: 0 auto 8px;
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
    .sources button {
        border: none;
        background: transparent;
    }
    .sources button[aria-pressed='true'] {
        background: var(--rail-surface-raised, #dfd3c8);
        color: var(--rail-text, #443c34);
        font-weight: 600;
    }
    .source-divider {
        height: 13px;
        border-left: 1px solid var(--rail-border, #b7a58f);
    }
    button.private {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: left;
    }
    button.private > :global(*) {
        width: 100%;
        box-sizing: border-box;
    }
    button.private:hover {
        filter: brightness(0.96);
    }
    button.private:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .seller {
        display: block;
        margin-top: 3px;
        text-align: right;
    }
    small {
        font-size: 11px;
        color: var(--rail-muted, #887969);
    }
    input {
        width: 76px;
        font: inherit;
        padding: 4px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 3px;
    }
    .commit {
        background: var(--rail-solid, #443c34);
        color: #faf7f2;
        border: none;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    p {
        text-align: center;
    }
    .prompt {
        margin: 0 0 6px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--rail-text, #63513e);
    }
</style>
