<script lang="ts">
    import { EighteenThirtyTwoMarket } from '@tabletop/1832'
    import { getCompany } from '@tabletop/18xx'
    import { CompanyActionCard, CompanyActionPanel } from '@tabletop/18xx-ui'
    import { companyShareFacts, redemptionHolderName } from './companyShareFacts.js'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<CompanyActionPanel label="Company share actions" heading="Act for a company">
        {#each session.companyShareOptions as { companyId, redemptions, reissue } (companyId)}
            {@const name = session.companyName(companyId)}
            <CompanyActionCard
                {session}
                {companyId}
                value={money(EighteenThirtyTwoMarket.companySpace(gameState.stockMarket, companyId).price)}
                facts={companyShareFacts(gameState, companyId, money)}
                actions={[
                    ...redemptions.map((choice) => {
                        const from = redemptionHolderName(choice.holder, (id) =>
                            session.getPlayerName(id)
                        )
                        return {
                            label: `Redeem from ${from}`,
                            detail: money(choice.price),
                            ariaLabel: `Redeem a ${name} share from ${from} for ${money(choice.price)}`,
                            disabled: busy,
                            onclick: () => session.redeemShare(choice)
                        }
                    }),
                    ...(reissue
                        ? [
                              {
                                  label: `Reissue ${reissue.certificateIds.length} ${reissue.certificateIds.length === 1 ? 'share' : 'shares'}`,
                                  detail: `at ${money(reissue.parPrice)}`,
                                  ariaLabel: `Reissue ${name}'s redeemed shares at ${money(reissue.parPrice)}`,
                                  disabled: busy,
                                  onclick: () => session.reissueShares(companyId)
                              }
                          ]
                        : [])
                ]}
            />
        {/each}
</CompanyActionPanel>
