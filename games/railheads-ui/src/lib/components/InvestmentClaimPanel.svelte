<script lang="ts">
    import { InvestmentItem, type CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ITEM_NAMES, industryName } from '$lib/utils/describeAction.js'
    import CompanyBadge from './CompanyBadge.svelte'
    import IndustryToken from './IndustryToken.svelte'

    const gameSession = getGameSession()

    const view = $derived(gameSession.investmentClaimView)
    const gameState = $derived(gameSession.gameState)
    // A bond's price goes to a company treasury or to the State Treasury.
    let fundedCompanyId: CompanyId | undefined = $state(undefined)

    function itemLabel(item: InvestmentItem): string {
        return item === InvestmentItem.Industry && view
            ? `${industryName(view.industry)} token`
            : ITEM_NAMES[item]
    }
</script>

{#if view}
    <div class="claim">
        <p class="prompt">
            {#if view.mine.length > 0}
                Your bid of ${view.amount}
                {view.mayDecline ? 'can buy' : 'wins'}:
                {view.mayDecline ? 'take the leftover or pass.' : 'choose an item.'}
            {:else}
                {gameSession.displayName(view.claimantId)} chooses
                {view.mayDecline ? 'whether to take the leftover' : 'an item'} for ${view.amount}.
            {/if}
        </p>
        <div class="row" role="group" aria-label="Items on offer">
            {#each view.items as item (item)}
                <span class="item" class:open={view.mine.includes(item)}>
                    {#if item === InvestmentItem.Industry}
                        <IndustryToken industry={view.industry} size={20} />
                    {/if}
                    {itemLabel(item)}
                </span>
            {/each}
        </div>
        {#if view.mine.length > 0}
            {#if view.mine.includes(InvestmentItem.Bond)}
                <label class="fund">
                    Bond money goes to
                    <select bind:value={fundedCompanyId}>
                        <option value={undefined}>the State Treasury</option>
                        {#each gameState.companies as company (company.id)}
                            <option value={company.id}>
                                {gameState.companyDefinition(company.id).shortName} treasury
                            </option>
                        {/each}
                    </select>
                </label>
                {#if fundedCompanyId}
                    <span class="note">Paying <CompanyBadge companyId={fundedCompanyId} /></span>
                {/if}
            {/if}
            <div class="row">
                {#each view.mine as item (item)}
                    <button
                        type="button"
                        class="primary"
                        onclick={() =>
                            gameSession.claimInvestment(
                                item,
                                item === InvestmentItem.Bond ? fundedCompanyId : undefined
                            )}>Take the {itemLabel(item)} · ${view.amount}</button
                    >
                {/each}
                {#if view.mayDecline}
                    <button
                        type="button"
                        class="secondary"
                        onclick={() => gameSession.declineInvestment()}>Pass</button
                    >
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .claim {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .prompt {
        margin: 0;
        font-size: 16px;
        text-align: center;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid #8f8a5c;
        border-radius: 6px;
        padding: 2px 8px;
        opacity: 0.6;
    }

    .item.open {
        opacity: 1;
        border-color: #33401a;
    }

    .fund {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }

    .note {
        font-size: 13px;
    }
</style>
