<script lang="ts">
    import { BidStep, Map1862, company1862, permitsOf } from '@tabletop/1862'
    import { AuctionBidControl, CompanyToken } from '@tabletop/18xx-ui'
    import type { Session1862 } from './session.svelte.js'
    import PermitBadges from './PermitBadges.svelte'
    let { session }: { session: Session1862 } = $props()
    const money = $derived(session.presentation.money)
    const decision = $derived(session.parliamentDecision)
    const name = (playerId: string) => session.getPlayerName(playerId)
    const home = (companyId: string) => {
        const locationId = company1862(companyId).home
        return Map1862.location(locationId).name ?? locationId
    }
</script>

{#snippet company(companyId: string, size: number)}
    <CompanyToken appearance={session.mapView.stations[companyId]} {size} />
{/snippet}

{#snippet details(companyId: string)}
    <div class="details">
        <strong>{session.companyName(companyId)}</strong>
        <span>Home {home(companyId)}</span>
        <PermitBadges kinds={permitsOf(session.gameState, companyId)} />
    </div>
{/snippet}

<section class="centered-panel parliament title-panel" aria-label="Parliament round">
    {#if decision?.kind === 'charter'}
        <h3>
            {@render company(decision.companyId, 30)}
            <span>
                {name(decision.playerId)} wins the charter for {money(decision.bid)}
            </span>
        </h3>
        {#if session.charterPars.length && session.canChooseAction}
            <p class="note">
                Set par on the chartered spaces and buy the director’s certificate, three shares at
                par, with up to two more. Half sold floats it with ten times par.
            </p>
            <div class="choices" role="group" aria-label="Par price">
                {#each session.charterPars as par (par)}
                    <button
                        aria-pressed={session.charterPar === par}
                        onclick={() => (session.charterPar = par)}>{money(par)}</button
                    >
                {/each}
            </div>
            {#if session.charterPar !== undefined}
                {@const par = session.charterPar}
                <div class="choices" role="group" aria-label="Shares to buy">
                    {#each session.charterShares(par) as extra (extra)}
                        <button
                            class="action-button"
                            onclick={() => session.obtainCharter(par, extra)}
                            >Buy {3 + extra} shares for {money(par * (3 + extra))}{extra === 2
                                ? ' and float'
                                : ''}</button
                        >
                    {/each}
                </div>
            {/if}
        {/if}
    {:else if decision?.kind === 'bid'}
        <h3>{@render company(decision.companyId, 30)}<span>Charter auction</span></h3>
        {@render details(decision.companyId)}
        <p class="note">
            High bid <strong>{money(decision.bid)}</strong> by
            {name(session.gameState.parliament?.auction?.playerId ?? decision.playerId)}
        </p>
        {#if session.myParliamentTurn}
            {@const amount = session.raiseAmount ?? session.minimumRaise}
            <AuctionBidControl
                {money}
                {amount}
                increment={BidStep}
                canBid={amount >= session.minimumRaise && session.mayBid(amount)}
                canDecrease={amount - BidStep >= session.minimumRaise}
                canIncrease={session.mayBid(amount + BidStep)}
                canPass={true}
                onChange={(value) => (session.raiseAmount = value)}
                onBid={() => session.raiseCharterBid(amount)}
                onPass={() => session.passCharterBid()}
            />
        {:else}
            <p class="note">{name(decision.playerId)} may raise or pass.</p>
        {/if}
    {:else if decision?.kind === 'open'}
        {#if session.myParliamentTurn}
            <h3><span>Petition Parliament for a charter, or pass</span></h3>
            {#if session.mayOpen}
                <div class="companies" role="group" aria-label="Companies to charter">
                    {#each session.charterableCompanyIds as companyId (companyId)}
                        <button
                            class="token-choice"
                            aria-label={`Petition for ${session.companyName(companyId)}`}
                            aria-pressed={session.selectedCharterCompany === companyId}
                            onclick={() =>
                                (session.selectedCharterCompany =
                                    session.selectedCharterCompany === companyId
                                        ? undefined
                                        : companyId)}>{@render company(companyId, 38)}</button
                        >
                    {/each}
                </div>
                {#if session.selectedCharterCompany}
                    {@render details(session.selectedCharterCompany)}
                    <AuctionBidControl
                        {money}
                        amount={session.charterBid}
                        increment={BidStep}
                        canBid={session.mayBid(session.charterBid)}
                        canDecrease={session.charterBid >= BidStep}
                        canIncrease={session.mayBid(session.charterBid + BidStep)}
                        onChange={(value) => (session.charterBid = value)}
                        onBid={() => session.openCharterAuction()}
                    />
                {/if}
            {/if}
            <button class="action-button" onclick={() => session.declineCharter()}>Pass</button>
        {:else}
            <p class="note">{name(decision.playerId)} may petition for a charter.</p>
        {/if}
    {/if}
</section>

<style>
    .parliament {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
    }
    .note {
        margin: 0;
        max-width: 34em;
        text-align: center;
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .companies,
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .details {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 12px;
    }
</style>
