<script lang="ts">
    import DraftCard from './DraftCard.svelte'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const draft = $derived(session.gameState.draft)
    const money = $derived(session.presentation.money)
    const finalOffer = $derived(
        draft.kind === 'public' && draft.stage === 'buying' && !!draft.finalOffer
    )
</script>

<section class="draft" aria-label="Opening company purchases">
    <header class="draft-heading">
        <h2>
            {session.gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')} · buy
            a company
        </h2>
        <p>
            Companies are face up. Buy one or pass. Two consecutive passes with at least two
            companies left lead to two operating rounds before purchases resume. The first purchase
            is mandatory.
        </p>
    </header>
    <div class="draft-cards">
        {#each session.openingCompanies as choice (choice.companyId)}
            <DraftCard {session} cardId={choice.companyId} price={choice.expectedPrice}>
                {#snippet actions()}
                    <button
                        class="action-button"
                        disabled={!session.canChooseAction ||
                            !session.openingChoices.some(
                                (available) => available.companyId === choice.companyId
                            )}
                        onclick={() => session.buyOpeningCompany(choice)}>Buy</button
                    >
                {/snippet}
            </DraftCard>
        {/each}
    </div>
    {#if finalOffer}
        <p class="draft-note">
            Passing reduces the last company's price by {money(10)}. Any independent railroad's debt
            must still be paid.
        </p>
    {/if}
    <div class="draft-pass">
        <button disabled={!session.canPassOpening} onclick={() => session.passOpeningPurchase()}>
            {finalOffer ? `Pass · reduce by ${money(10)}` : 'Pass'}
        </button>
    </div>
</section>
