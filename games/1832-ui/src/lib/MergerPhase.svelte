<script lang="ts">
    import { getCompany, type ShareSaleDetails } from '@tabletop/18xx'
    import {
        CompanyActionCard,
        CompanyActionPanel,
        TrainBadge,
        type CardAction
    } from '@tabletop/18xx-ui'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const initials = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
    const name = (playerId: string) => session.getPlayerName(playerId)
    function proposalAction({
        option,
        terms
    }: (typeof session.mergerProposals)[number]): CardAction {
        if (terms.kind === 'system') {
            const label = option.yielded
                ? `Form a System, ${name(terms.initiator)} initiating`
                : 'Form a System'
            return {
                label,
                detail: `${money(terms.price)} · ${name(terms.president)} presides`,
                ariaLabel: `${label} of ${initials(option.companyId)} and ${initials(option.partnerId)}`,
                disabled: busy,
                onclick: () => session.proposeMerger(option)
            }
        }
        const label = option.yielded
            ? `Be taken over by ${initials(option.partnerId)}`
            : `Take over ${initials(option.partnerId)}`
        return {
            label,
            detail: money(terms.price),
            ariaLabel: `${initials(option.companyId)}: ${label} for ${money(terms.price)}`,
            disabled: busy,
            onclick: () => session.proposeMerger(option)
        }
    }
    function saleAction(sale: ShareSaleDetails): CardAction {
        const [{ companyId, shares }] = sale.sales
        return {
            label: `Sell ${shares}`,
            detail: money(sale.proceeds),
            ariaLabel: `Sell ${shares} ${initials(companyId)} for ${money(sale.proceeds)}`,
            disabled: busy,
            onclick: () => session.sellTakeoverShares(sale)
        }
    }
</script>

{#if session.mergerAnswer}
    {@const { proposal, terms } = session.mergerAnswer}
    <header class="merger-prompt">
        <span>
            {#if terms.kind === 'system'}
                {name(proposal.proposerPlayerId)} proposes forming a System of {initials(
                    proposal.companyId
                )} and {initials(proposal.partnerId)} at {money(terms.price)}, {name(
                    terms.president
                )} presiding.
            {:else}
                {name(proposal.proposerPlayerId)} proposes that {initials(terms.buyerId)} take over
                {initials(terms.targetId)}, paying {money(terms.price)} for its shares.
            {/if}
        </span>
        <button
            class="action-button inline-action"
            disabled={busy}
            onclick={() => session.answerMerger(true)}>agree</button
        >
        <button
            class="action-button inline-action"
            disabled={busy}
            onclick={() => session.answerMerger(false)}>refuse</button
        >
    </header>
{:else if session.takeoverFunding}
    {@const funding = session.takeoverFunding}
    <CompanyActionPanel
        label="Takeover funding"
        heading={`Raise ${money(funding.shortfall)} for ${initials(funding.buyerId)}'s takeover of ${initials(funding.targetId)}`}
    >
        {#each funding.companies as { companyId, sales } (companyId)}
            <CompanyActionCard {session} {companyId} actions={sales.map(saleAction)} />
        {/each}
    </CompanyActionPanel>
{:else if session.mergedTrainDiscards}
    {@const discards = session.mergedTrainDiscards}
    <CompanyActionPanel
        label="Train discards"
        heading={`${getCompany(gameState, discards.companyId).name} has ${discards.excess} ${discards.excess === 1 ? 'train' : 'trains'} over its limit`}
    >
        {#each discards.trains as train (train.id)}
            <button
                class="action-button"
                disabled={busy}
                onclick={() => session.discardMergedTrain(discards.companyId, train.id)}
                >Discard <TrainBadge
                    name={session.trainDepot.trainDefinition(train.definitionId).name}
                    color={session.presentation.trainColors[train.definitionId]}
                /></button
            >
        {/each}
    </CompanyActionPanel>
{:else if session.myMergerDecision?.kind === 'propose'}
    <CompanyActionPanel label="Merger proposals" heading="Propose a merger">
        {#each session.mergerPairings as { companyId, partnerId, proposals } (`${companyId}|${partnerId}`)}
            <CompanyActionCard
                {session}
                companyId={partnerId}
                title={`${initials(companyId)} with ${getCompany(gameState, partnerId).name}`}
                actions={proposals.map(proposalAction)}
            />
        {/each}
    </CompanyActionPanel>
    <div class="pass">
        <button class="action-button" disabled={busy} onclick={() => session.passMerger()}
            >Pass</button
        >
    </div>
{:else if session.mergerDecision}
    <header class="merger-prompt">
        <span>{name(session.mergerDecision.playerId)} is deciding on mergers</span>
    </header>
{/if}

<style>
    .merger-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .merger-prompt button {
        margin: 0;
    }
    .pass {
        display: flex;
        justify-content: center;
        padding: 6px 0;
    }
</style>
