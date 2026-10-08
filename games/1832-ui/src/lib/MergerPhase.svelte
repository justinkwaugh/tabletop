<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import { CompanyActionCard, CompanyActionPanel, type CardAction } from '@tabletop/18xx-ui'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const initials = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
    const name = (playerId: string) => session.getPlayerName(playerId)
    function proposalAction(
        proposal: (typeof session.mergerProposals)[number]
    ): CardAction {
        const { option } = proposal
        if (proposal.kind === 'system') {
            const label = option.yielded
                ? `Form a System, ${name(proposal.initiator)} initiating`
                : 'Form a System'
            return {
                label,
                detail: `${money(proposal.price)} · ${name(proposal.president)} presides`,
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
            detail: money(proposal.price),
            ariaLabel: `${initials(option.companyId)}: ${label} for ${money(proposal.price)}`,
            disabled: busy,
            onclick: () => session.proposeMerger(option)
        }
    }
</script>

{#if session.mergerAnswer}
    {@const answer = session.mergerAnswer}
    {@const option = answer.option}
    <header class="merger-prompt">
        <span>
            {#if answer.kind === 'system'}
                {name(answer.proposerPlayerId)} proposes forming a System of {initials(
                    option.companyId
                )} and {initials(option.partnerId)} at {money(answer.price)}, {name(
                    answer.president
                )} presiding.
            {:else}
                {name(answer.proposerPlayerId)} proposes that {initials(answer.buyerId)} take over
                {initials(answer.targetId)}, paying {money(answer.price)} for its shares.
            {/if}
        </span>
        <button class="action-button inline-action" onclick={() => session.answerMerger(true)}
            >agree</button
        >
        <button class="action-button inline-action" onclick={() => session.answerMerger(false)}
            >refuse</button
        >
    </header>
{:else if session.takeoverFunding}
    {@const funding = session.takeoverFunding}
    <CompanyActionPanel
        label="Takeover funding"
        heading={`Sell shares for ${initials(funding.buyerId)}'s takeover of ${initials(funding.targetId)}`}
    >
        {#each funding.sales as sale (`${sale.sales[0].companyId}:${sale.sales[0].shares}`)}
            {@const [{ companyId, shares }] = sale.sales}
            <CompanyActionCard
                {session}
                {companyId}
                actions={[
                    {
                        label: `Sell ${shares}`,
                        detail: money(sale.proceeds),
                        ariaLabel: `Sell ${shares} ${initials(companyId)} for ${money(sale.proceeds)}`,
                        disabled: busy,
                        onclick: () => session.sellTakeoverShares(sale)
                    }
                ]}
            />
        {/each}
    </CompanyActionPanel>
{:else if session.mergedTrainDiscards.length}
    <CompanyActionPanel label="Train discards" heading="Discard a train to the open market">
        {#each session.mergedTrainDiscards as train (train.id)}
            <button
                class="action-button"
                disabled={busy}
                onclick={() => session.discardMergedTrain(train.id)}
                >Discard {train.definitionId}-train</button
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
