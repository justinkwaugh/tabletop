<script lang="ts">
    import { getCompany, openShorts } from '@tabletop/18xx'
    import CompanyActionCard from '../stock/CompanyActionCard.svelte'
    import CompanyActionPanel from '../stock/CompanyActionPanel.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    let { session }: { session: SizedCompanySessionView } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<CompanyActionPanel label="Short selling" heading="Short a company">
    {#each session.shortSelling.options as { companyId, price } (companyId)}
        {@const company = getCompany(session.gameState, companyId)}
        <CompanyActionCard
            {session}
            {companyId}
            value={money(price)}
            facts={[
                {
                    label: 'Size',
                    value: String(
                        session.sizedCompanies.market.shareCount(session.gameState, companyId)
                    )
                },
                {
                    label: 'Shorts',
                    value: String(openShorts(session.gameState, companyId).length)
                }
            ]}
            actions={[
                {
                    label: 'Short',
                    detail: `+${money(price)}`,
                    ariaLabel: `Short ${session.companyName(company.id)} (${money(price)})`,
                    disabled: busy,
                    onclick: () => session.shortSelling.short(companyId)
                }
            ]}
        />
    {/each}
</CompanyActionPanel>
