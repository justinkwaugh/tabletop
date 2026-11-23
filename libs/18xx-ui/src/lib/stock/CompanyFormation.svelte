<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import AuctionPlayers from '../auctions/AuctionPlayers.svelte'
    import { auctionSummaryPlayers } from '../auctions/auctionSummary.js'
    import SlidingToggle from '../table/SlidingToggle.svelte'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const module = $derived(session.companyAuction)
    const pending = $derived.by(() => {
        assertExists(module.pending, 'Formation requires a won company auction')
        return module.pending
    })
    const terms = $derived.by(() => {
        assertExists(module.model, 'Formation requires company auctions')
        return module.model.terms
    })
    const company = $derived(getCompany(session.gameState, pending.companyId))
    const companyName = $derived(session.actionCompanyName(company.id))
    const choice = $derived(module.formationChoice)
    const payment = $derived(module.formationPayment)
    const reason = $derived(module.formationProblem)
    const paymentSplit = $derived.by(() => {
        if (!payment) return undefined
        const parts = [
            ...(payment.subsidy ? [`${money(payment.subsidy)} subsidy`] : []),
            ...(module.contributions.length ? [`${money(payment.privatesValue)} privates`] : [])
        ]
        return parts.length ? [`${money(pending.price)} bid`, ...parts].join(' − ') : undefined
    })
    const startPrice = $derived(
        session.stockMarketChart.space(terms.startSpace(session.gameState, pending.price)).price
    )
</script>

<article class="centered-panel" aria-label="Company formation">
    <div class="formation">
        <div class="company">
            <CompanyToken appearance={session.mapView.stations[company.id]} size={48} />
            <div>
                <strong>{companyName}</strong>
                <span
                    ><AuctionPlayers
                        players={auctionSummaryPlayers(session, [pending.playerId])}
                        emphasis={false}
                    /> won for {money(pending.price)} · starts at {money(startPrice)}</span
                >
            </div>
        </div>
        <div class="size" role="group" aria-label="Company size">
            <span class="label">Size</span>
            <SlidingToggle
                count={module.shareCounts.length}
                selectedIndex={choice ? module.shareCounts.indexOf(choice.shareCount) : -1}
            >
                {#each module.shareCounts as shareCount (shareCount)}<button
                        aria-pressed={choice?.shareCount === shareCount}
                        disabled={!module.canForm}
                        onclick={() => module.setShareCount(shareCount)}>{shareCount} shares</button
                    >{/each}
            </SlidingToggle>
        </div>
        {#if module.contributions.length}
            <section class="contributions" aria-labelledby="formation-contributions">
                <h3 id="formation-contributions">Contribute privates</h3>
                <p>
                    A private you contribute goes to {companyName} and pays its face value toward the
                    {money(pending.price)} bid, so you pay less cash.
                </p>
                <div class="choices">
                    {#each module.contributions as privateId (privateId)}
                        {@const chosen = !!choice?.privateIds.includes(privateId)}
                        <button
                            class="private"
                            aria-pressed={chosen}
                            disabled={!module.canForm}
                            onclick={() => module.toggleContribution(privateId)}
                            ><span class="check" aria-hidden="true">{chosen ? '✓' : ''}</span
                            >{session.actionCompanyName(privateId)}
                            <b>{money(module.contributionValue(privateId))}</b></button
                        >
                    {/each}
                </div>
            </section>
        {/if}
        {#if payment}
            <p class="payment" role="status">
                You pay <strong>{money(payment.cash)}</strong> in cash
                {#if paymentSplit}<span class="split">({paymentSplit})</span>{/if}
            </p>
        {/if}
        {#if reason}<p role="status">{reason}</p>{/if}
        <button
            class="action-button"
            disabled={!module.canForm || !!reason}
            onclick={() => module.form()}>Form {companyName}</button
        >
    </div>
</article>

<style>
    .formation {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .company div {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .company span,
    p {
        margin: 0;
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .size {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .label,
    h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--rail-muted, #887664);
    }
    .size button {
        padding: 4px 14px;
        font-size: 12px;
        line-height: 16px;
    }
    .size button:disabled {
        cursor: default;
    }
    .contributions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        max-width: 420px;
        text-align: center;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .payment strong {
        font-size: 14px;
    }
    .split {
        color: var(--rail-muted, #887664);
    }
    .private,
    .action-button {
        font: inherit;
        padding: 6px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, white);
        color: inherit;
        cursor: pointer;
    }
    .private {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .private b {
        font-variant-numeric: tabular-nums;
    }
    .check {
        display: inline-grid;
        place-items: center;
        width: 14px;
        height: 14px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 3px;
        font-size: 11px;
        line-height: 1;
    }
    .private[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .private[aria-pressed='true'] .check {
        border-color: currentColor;
    }
    .private:disabled,
    .action-button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
