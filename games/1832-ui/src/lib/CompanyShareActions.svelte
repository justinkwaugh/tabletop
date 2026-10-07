<script lang="ts">
    import { companyMarketSpace, getCompany } from '@tabletop/18xx'
    import { CompanyActionCard, StockPanelHeading } from '@tabletop/18xx-ui'
    import { companyShareFacts } from './companyShareFacts.js'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

<section aria-label="Company share actions">
    <StockPanelHeading text="Act for a company" />
    <div class="cards">
        {#each session.companyShareActions as { companyId, redemptions, reissue } (companyId)}
            {@const name = getCompany(gameState, companyId).name}
            <CompanyActionCard
                {session}
                {companyId}
                value={money(companyMarketSpace(gameState.stockMarket, companyId).price)}
                facts={companyShareFacts(gameState, companyId, money)}
                actions={[
                    ...redemptions.map((choice) => {
                        const from =
                            choice.holder.kind === 'player'
                                ? session.getPlayerName(choice.holder.playerId)
                                : 'the market'
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
