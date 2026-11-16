<script lang="ts">
    import { Market1861 } from '@tabletop/1861'
    import { finiteCashOwnedBy, trainsOwnedBy } from '@tabletop/18xx'
    import { CompanyActionCard, StockPanelHeading, type CardAction } from '@tabletop/18xx-ui'
    import type { Session1861 } from './session.svelte.js'
    let { session }: { session: Session1861 } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const round = $derived(session.mergerRound)
    const proposal = $derived(session.proposal)
    const decision = $derived(session.mergerDecision)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const name = (id: string) => session.companyName(id)
    const player = (id: string) => session.getPlayerName(id)
    const price = (companyId: string) =>
        gameState.stockMarket.stacks.some((stack) => stack.companyIds.includes(companyId))
            ? money(Market1861.companySpace(gameState.stockMarket, companyId).price)
            : undefined
    const shares = (count: number) => `${count} share${count === 1 ? '' : 's'}`

    function minorFacts(companyId: string) {
        const trains = trainsOwnedBy(gameState, { kind: 'company', companyId })
        const company = gameState.companies.find((entry) => entry.id === companyId)
        const owner = company?.president?.kind === 'player' ? company.president.playerId : undefined
        return [
            ...(owner
                ? [
                      {
                          label: company?.kind === 'major' ? 'Director' : 'Owner',
                          value: player(owner)
                      }
                  ]
                : []),
            {
                label: 'Treasury',
                value: money(finiteCashOwnedBy(gameState, { kind: 'company', companyId }))
            },
            {
                label: 'Trains',
                value: trains.length ? trains.map((train) => train.definitionId).join(', ') : '—'
            },
            { label: 'Loans', value: String(company?.loans ?? 0) }
        ]
    }

    const deciding = $derived(round?.minorIds[0])
    // Once formed, the public company is the subject; until then the deciding minor.
    const subjectId = $derived(
        proposal && (proposal.stage === 'open' || proposal.stage === 'discard')
            ? proposal.majorId
            : (proposal?.minorId ?? deciding)
    )
    const actions = $derived.by((): CardAction[] =>
        decision
            ? [
                  {
                      label: 'Pass',
                      ariaLabel: `Pass with ${name(decision.minorId)}`,
                      disabled: busy,
                      onclick: () => session.passMerger()
                  }
              ]
            : []
    )
    const allotmentText = (entries: readonly { playerId: string; shares: number }[]) =>
        entries
            .filter((entry) => entry.shares > 0)
            .map((entry) => `${player(entry.playerId)} ${shares(entry.shares)}`)
            .join(' · ')
</script>

<section aria-label="Merger round" class="merger-round">
    <StockPanelHeading text="Merger round" />
    {#if subjectId}
        <div class="subject">
            <CompanyActionCard
                {session}
                companyId={subjectId}
                title={name(subjectId)}
                value={price(subjectId)}
                facts={minorFacts(subjectId)}
                {actions}
            />
        </div>
    {/if}

    {#if decision}
        {#if session.conversionPreview}
            <h3>Convert at {money(session.conversionPreview.price)} into</h3>
            <div class="choices">
                {#each decision.majorIds as majorId (majorId)}
                    <button
                        class="action-button"
                        disabled={busy}
                        aria-label="Convert {name(decision.minorId)} into {name(majorId)}"
                        onclick={() => session.convertMinor(majorId)}>{majorId}</button
                    >
                {/each}
            </div>
        {:else}
            <p class="note">
                {name(decision.minorId)} converts only from the yellow column, R100 to R165.
            </p>
        {/if}
        {#if decision.partnerIds.length}
            <h3>Or merge with</h3>
            <div class="choices">
                {#each decision.partnerIds as minorId (minorId)}
                    <button
                        class="toggle"
                        aria-pressed={session.chosenPartners.includes(minorId)}
                        disabled={busy}
                        onclick={() => session.togglePartner(minorId)}
                        >{minorId} <span class="detail">{price(minorId) ?? ''}</span></button
                    >
                {/each}
            </div>
            {#if session.mergerDraft}
                {@const draft = session.mergerDraft}
                <p>
                    {draft.minorIds.join(' + ')} at {money(draft.preview.price)}: {allotmentText(
                        draft.preview.allotments
                    )}; {player(draft.preview.directorId)} directs.
                </p>
                {#if draft.reason}
                    <p class="note">{draft.reason}</p>
                {:else}
                    <div class="choices">
                        {#each decision.majorIds as majorId (majorId)}
                            <button
                                class="action-button"
                                disabled={busy}
                                aria-label="Merge into {name(majorId)}"
                                onclick={() => session.mergeMinors(majorId)}>Form {majorId}</button
                            >
                        {/each}
                    </div>
                {/if}
            {/if}
        {/if}
    {/if}

    {#if proposal}
        {#if proposal.stage === 'open' || proposal.stage === 'discard'}
            <p>{name(proposal.majorId)} formed from {proposal.minorIds.join(' + ')}.</p>
        {:else}
            <p>
                {proposal.kind === 'convert' ? 'Converting' : 'Merging'}
                {proposal.minorIds.join(' + ')} into {name(proposal.majorId)} at {money(
                    session.proposalPrice ?? 0
                )}.
            </p>
        {/if}
        {#if proposal.stage !== 'open' && proposal.stage !== 'discard'}
            <p class="note">Shares: {allotmentText(proposal.allotments)}</p>
        {/if}
        {#if session.canAnswerMerger}
            <div class="choices">
                <button
                    class="action-button"
                    disabled={busy}
                    onclick={() => session.answerMerger(true)}>Agree</button
                >
                <button
                    class="action-button"
                    disabled={busy}
                    onclick={() => session.answerMerger(false)}>Refuse</button
                >
            </div>
        {/if}
        {#if session.stationChoice}
            {@const choice = session.stationChoice}
            <h3>Keep two stations</h3>
            <div class="choices">
                {#each choice.stations as station (station.stationId)}
                    <button
                        class="toggle"
                        aria-pressed={choice.chosen.includes(station.stationId)}
                        disabled={busy}
                        onclick={() => session.toggleStation(station.stationId)}
                        >{session.placeName(station.locationId)}
                        <span class="detail">{station.minorId}</span></button
                    >
                {/each}
            </div>
            <div class="choices">
                <button
                    class="action-button"
                    disabled={busy || !!choice.reason}
                    onclick={() => session.chooseStations()}>Keep these</button
                >
            </div>
        {/if}
        {#if session.shareOffer}
            {@const offer = session.shareOffer}
            <h3>
                {offer.open ? 'Buy a share' : 'Buy shares'} at {money(session.proposalPrice ?? 0)}
            </h3>
            <div class="choices">
                {#each Array.from({ length: offer.most + 1 }, (_, count) => count) as count (count)}
                    <button
                        class="action-button"
                        disabled={busy}
                        onclick={() => session.buyMergerShares(count)}
                        >{count ? shares(count) : 'None'}</button
                    >
                {/each}
            </div>
        {/if}
        {#if session.mergerDiscards}
            <h3>Discard a train to the bank pool</h3>
            <div class="choices">
                {#each session.mergerDiscards as train (train.id)}
                    <button
                        class="action-button"
                        disabled={busy}
                        onclick={() => session.discardMergerTrain(train.id)}
                        >{train.definitionId}</button
                    >
                {/each}
            </div>
        {/if}
    {/if}
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    .subject {
        display: flex;
        justify-content: center;
        margin-bottom: 10px;
    }
    h3 {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    p {
        margin: 4px 0;
    }
    .note {
        color: var(--rail-muted, #887969);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        margin-top: 4px;
    }
    .detail {
        color: var(--rail-muted, #887969);
    }
    .choices button {
        min-height: 30px;
        padding: 3px 14px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        cursor: pointer;
    }
    .choices button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .toggle {
        background: var(--rail-surface, #fbf7f0);
        color: var(--rail-text, #514536);
    }
    .toggle[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-raised, #efe7db);
        font-weight: 600;
    }
</style>
