<script lang="ts">
    import { getCompany, openShorts } from '@tabletop/18xx'
    import CompanyActionCard from './CompanyActionCard.svelte'
    import StockPanelHeading from './StockPanelHeading.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<section aria-label="Short selling">
    <StockPanelHeading text="Short a company" />
    <div class="cards">
        {#each session.shorts as { companyId, price } (companyId)}
            {@const company = getCompany(session.gameState, companyId)}
            <CompanyActionCard
                {session}
                {companyId}
                value={money(price)}
                facts={[
                    { label: 'Size', value: String(company.shareCount) },
                    {
                        label: 'Shorts',
                        value: String(openShorts(session.gameState, companyId).length)
                    }
                ]}
                actions={[
                    {
                        label: 'Short',
                        detail: `+${money(price)}`,
                        ariaLabel: `Short ${company.name} (${money(price)})`,
                        disabled: busy,
                        onclick: () => session.shortShare(companyId)
                    }
                ]}
            />
        {/each}
    </div>
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
</style>
