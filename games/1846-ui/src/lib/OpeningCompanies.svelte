<script lang="ts">
    import { draftCompany } from '@tabletop/1846'
    import type { EighteenFortySixSession } from './session.svelte.js'
    import { CompanyDescriptions } from './companyDescriptions.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const draft = $derived(session.gameState.draft)
</script>

<section aria-label="Opening company purchases">
    <h2>
        {session.gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')} · buy a
        company
    </h2>
    <p>
        Companies are face up. Buy one or pass. Two consecutive passes with at least two companies
        left lead to two operating rounds before purchases resume. The first purchase is mandatory.
    </p>
    {#if draft.kind === 'public' && draft.stage === 'buying' && draft.finalOffer}
        <p>
            Passing reduces the last company's price by $10. Any independent railroad's debt must
            still be paid.
        </p>
    {/if}
    <div class="companies">
        {#each session.openingCompanies as choice (choice.companyId)}
            {@const company = draftCompany(choice.companyId)}
            <button
                disabled={!session.canChooseAction ||
                    !session.openingChoices.some(
                        (available) => available.companyId === choice.companyId
                    )}
                onclick={() => session.buyOpeningCompany(choice)}
            >
                <strong>{company.name} · ${choice.expectedPrice}</strong>
                <span>{CompanyDescriptions[company.id]}</span>
                <small
                    >{company.kind === 'independent'
                        ? `$${company.price} treasury + $${company.debt} debt`
                        : `$${company.revenue} income per operating round`}</small
                >
            </button>
        {/each}
    </div>
    <button disabled={!session.canPassOpening} onclick={() => session.passOpeningPurchase()}>
        {draft.kind === 'public' && draft.stage === 'buying' && draft.finalOffer
            ? 'Pass · reduce by $10'
            : 'Pass'}
    </button>
</section>

<style>
    .companies {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
    }
    .companies button {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: left;
        width: 240px;
        padding: 12px;
        border: 1px solid #b8ac9b;
        border-radius: 5px;
    }
    button:disabled {
        opacity: 0.55;
    }
</style>
