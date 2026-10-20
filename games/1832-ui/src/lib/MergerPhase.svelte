<script lang="ts">
    import { type ShareSaleDetails } from '@tabletop/18xx'
    import { nextSystemId } from '@tabletop/1832'
    import {
        CompanyActionCard,
        CompanyActionPanel,
        CompanyToken,
        DecisionResponse,
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
    const presides = (playerId: string, proposerPlayerId: string) =>
        playerId === proposerPlayerId ? 'you preside' : `${name(playerId)} presides`
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

{#snippet tokenChoice(companyId: string, chosen: boolean, choose: () => void)}
    <button
        class="token-choice"
        aria-pressed={chosen}
        aria-label={session.companyName(companyId)}
        disabled={busy}
        onclick={choose}
        ><CompanyToken appearance={session.mapView.stations[companyId]} size={34} /><span
            >{initials(companyId)}</span
        ></button
    >
{/snippet}

{#if session.mergerAnswer}
    {@const { proposal, terms } = session.mergerAnswer}
    <section class="centered-panel" aria-label="Merger response">
        <DecisionResponse
            label="Merger response"
            acceptLabel="Agree"
            disabled={busy}
            onAccept={() => session.answerMerger(true)}
            onDecline={() => session.answerMerger(false)}
        >
            {#each [proposal.companyId, proposal.partnerId] as companyId (companyId)}<CompanyToken
                    appearance={session.mapView.stations[companyId]}
                    size={24}
                />{/each}
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
        </DecisionResponse>
    </section>
{:else if session.takeoverFunding}
    {@const funding = session.takeoverFunding}
    {@const buyer = initials(funding.buyerId)}
    {@const target = initials(funding.targetId)}
    <section class="centered-panel funding" aria-label="Takeover funding">
        <h3>
            <CompanyToken appearance={session.mapView.stations[funding.buyerId]} size={18} />
            <strong>{buyer}</strong> takes over
            <CompanyToken appearance={session.mapView.stations[funding.targetId]} size={18} />
            <strong>{target}</strong>
        </h3>
        <table class="breakdown" aria-label="Takeover cost">
            <tbody>
                <tr><th>{target}’s shares</th><td>{money(funding.price)}</td></tr>
                <tr><th>{buyer}’s treasury</th><td>−{money(funding.treasury)}</td></tr>
                <tr><th>Your cash</th><td>−{money(funding.presidentCash)}</td></tr>
                {#if funding.ownSharesPaid}
                    <tr
                        ><th>Paid for your {target} shares</th><td
                            >−{money(funding.ownSharesPaid)}</td
                        ></tr
                    >
                {/if}
                <tr class="total"><th>Still to raise</th><td>{money(funding.shortfall)}</td></tr>
            </tbody>
        </table>
        {#if funding.sold.length}
            <p class="sold">
                Sold {funding.sold
                    .map(
                        (sale) =>
                            `${sale.sales[0].shares} ${initials(sale.sales[0].companyId)} for ${money(sale.proceeds)}`
                    )
                    .join(', ')}
            </p>
        {/if}
        <CompanyActionPanel label="Takeover funding sales" heading="Sell your shares">
            {#each funding.companies as { companyId, sales } (companyId)}
                <CompanyActionCard {session} {companyId} actions={sales.map(saleAction)} />
            {/each}
        </CompanyActionPanel>
        <p class="hint">
            Any shares but {target}’s, as long as you keep {buyer}’s presidency, and no more than
            the rest needs.
        </p>
    </section>
{:else if session.mergedTrainDiscards}
    {@const discards = session.mergedTrainDiscards}
    {@const chosen = session.mergedDiscardChoice}
    {@const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name}
    <section class="centered-panel discards" aria-label="Train discards">
        <h3 class="sentence">
            <CompanyToken appearance={session.mapView.stations[discards.companyId]} size={24} />
            <strong>{session.companyName(discards.companyId)}</strong>
            <span>discards {discards.excess} {discards.excess === 1 ? 'train' : 'trains'}</span>
        </h3>
        <p class="note">
            Its train limit is {discards.limit}. Discarded trains go to the open market.
        </p>
        <div class="trains" role="group" aria-label="Trains to discard">
            {#each discards.kinds as { definitionId, trainIds } (definitionId)}
                <button
                    class="train"
                    aria-label={`Choose a ${trainName(definitionId)} to discard`}
                    aria-pressed={chosen?.definitionId === definitionId}
                    disabled={busy}
                    onclick={() => session.chooseMergedDiscard(definitionId)}
                    ><TrainBadge
                        name={trainName(definitionId)}
                        color={session.presentation.trainColors[definitionId]}
                    />{#if trainIds.length > 1}<span class="count">×{trainIds.length}</span
                        >{/if}</button
                >
            {/each}
        </div>
        {#if chosen}
            <button
                class="action-button confirm"
                disabled={busy}
                onclick={() => session.discardChosenMergedTrain()}
                >Discard a {trainName(chosen.definitionId)}</button
            >
        {/if}
    </section>
{:else if session.myMergerDecision?.kind === 'propose'}
    {@const proposer = session.myMergerDecision.playerId}
    {@const companyId = session.mergerCompanyId}
    {@const outcomes = session.mergerOutcomes}
    <section class="centered-panel proposals" aria-label="Merger proposals">
        {#if session.mergerCompanyIds.length > 1}
            <h3>Merge</h3>
            <div class="tokens" role="group" aria-label="Your companies">
                {#each session.mergerCompanyIds as id (id)}
                    {@render tokenChoice(id, id === companyId, () =>
                        session.chooseMergerCompany(id)
                    )}
                {/each}
            </div>
        {/if}
        {#if companyId}
            <h3>
                {#if session.mergerCompanyIds.length > 1}with{:else}Merge <CompanyToken
                        appearance={session.mapView.stations[companyId]}
                        size={18}
                    />
                    <strong>{initials(companyId)}</strong> with{/if}
            </h3>
            <div class="tokens" role="group" aria-label="Merge with">
                {#each session.mergerPartnerIds as id (id)}
                    {@render tokenChoice(id, id === session.mergerPartnerId, () =>
                        session.chooseMergerPartner(id)
                    )}
                {/each}
            </div>
        {/if}
        {#if outcomes}
            {@const systemId = nextSystemId(gameState)}
            <div class="outcomes">
                {#if outcomes.system}
                    {@const system = outcomes.system}
                    <div class="outcome">
                        <button
                            class="propose"
                            disabled={busy}
                            aria-label={`Propose a System of ${initials(outcomes.companyId)} and ${initials(outcomes.partnerId)} at ${money(system.terms.price)}, ${name(system.terms.president)} presiding`}
                            onclick={() => session.proposeMerger(system.option)}
                        >
                            <span class="title"
                                >{#if systemId}<CompanyToken
                                        appearance={session.mapView.stations[systemId]}
                                        size={18}
                                    />Form {initials(systemId)}{:else}Form a System{/if}</span
                            >
                            <span class="price">{money(system.terms.price)}</span>
                            <span class="detail"
                                >per share{#if outcomes.presidencies.length === 1}, {presides(
                                        system.terms.president,
                                        proposer
                                    )}{/if}</span
                            >
                        </button>
                        {#if outcomes.presidencies.length > 1}
                            <div class="presidency" role="group" aria-label="System president">
                                {#each outcomes.presidencies as choice (choice.terms.president)}
                                    <button
                                        style:--player-color={session.colors.getPlayerBgColorValue(
                                            choice.terms.president
                                        )}
                                        disabled={busy}
                                        aria-pressed={choice === system}
                                        aria-label={presides(choice.terms.president, proposer)}
                                        onclick={() =>
                                            session.chooseSystemPresidency(!!choice.option.yielded)}
                                        ><span class="player-color"></span><span class="player-name"
                                            >{choice.terms.president === proposer
                                                ? 'you'
                                                : name(choice.terms.president)}</span
                                        ></button
                                    >
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
                {#each outcomes.takeovers as takeover (takeover.terms.buyerId)}
                    {@const { buyerId, targetId, price } = takeover.terms}
                    <button
                        class="outcome propose"
                        disabled={busy}
                        aria-label={`Propose that ${initials(buyerId)} buy ${initials(targetId)} for ${money(price)}`}
                        onclick={() => session.proposeMerger(takeover.option)}
                    >
                        <span class="title">{initials(buyerId)} buys {initials(targetId)}</span>
                        <span class="price">{money(price)}</span>
                        <span class="detail">for {initials(targetId)}’s shares</span>
                    </button>
                {/each}
            </div>
        {:else if companyId}
            <p class="hint">Choose a company to see what merging would make.</p>
        {/if}
        <div class="pass">
            <button class="action-button" disabled={busy} onclick={() => session.passMerger()}
                >Pass</button
            >
        </div>
    </section>
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
        text-align: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .pass {
        display: flex;
        justify-content: center;
        padding: 6px 0;
    }
    .proposals .pass {
        padding-top: 12px;
    }
    .proposals .pass button {
        padding: 6px 18px;
        border-radius: 4px;
        font-size: 13px;
    }
    .proposals {
        text-align: center;
        font-size: 13px;
    }
    h3 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 0 0 8px;
        color: var(--rail-muted, #887969);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    h3 strong {
        color: var(--rail-text, #514536);
        font-size: 13px;
        letter-spacing: 0;
        text-transform: none;
    }
    .tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-bottom: 12px;
    }
    .token-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 6px 10px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--rail-text, #514536);
        font-weight: 600;
        cursor: pointer;
    }
    .token-choice:hover:not(:disabled) {
        background: var(--rail-hover, #efe7db);
    }
    .token-choice[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-selected, #e5d9c8);
    }
    .outcomes {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        max-width: 528px;
        margin: 0 auto;
    }
    .outcomes > .outcome {
        flex: 1 1 104px;
        min-width: 0;
        max-width: 170px;
    }
    .outcome {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        overflow: hidden;
    }
    .propose {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 10px 8px 8px;
        border: 0;
        background: transparent;
        color: var(--rail-text, #514536);
        cursor: pointer;
    }
    button.outcome.propose {
        border: 1px solid var(--rail-border, #c7b8a6);
        background: var(--rail-surface-raised, #efe7db);
    }
    /* The hover tint is translucent, so it lies over the whole tile once. */
    .outcome:has(> .propose:hover:not(:disabled)),
    button.outcome.propose:hover:not(:disabled) {
        box-shadow: inset 0 0 0 100vmax var(--rail-hover, #e5d9c8);
    }
    .propose:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .title {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        font-size: 13px;
        font-weight: 600;
    }
    .price {
        font-size: 16px;
        font-weight: 700;
    }
    .detail {
        color: var(--rail-muted, #887969);
        font-size: 11px;
    }
    /* Inset in the tile, so the tile still reads as one button with a choice inside it. */
    .presidency {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0 8px 8px;
        padding: 2px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 8px;
        background: var(--rail-surface-inset, #1b232d);
    }
    .presidency button {
        display: inline-flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 0;
        padding: 3px 6px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--rail-muted, #887969);
        font-size: 11px;
        white-space: nowrap;
        cursor: pointer;
    }
    .presidency button:hover:not(:disabled):not([aria-pressed='true']) {
        color: var(--rail-text, #514536);
    }
    .presidency button[aria-pressed='true'] {
        background: color-mix(in srgb, var(--player-color) 35%, var(--rail-surface, #222c37));
        color: var(--rail-text, #514536);
        font-weight: 600;
    }
    .player-name {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .player-color {
        width: 8px;
        height: 8px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--player-color);
    }
    .hint {
        margin: 0 0 4px;
        color: var(--rail-muted, #887969);
    }
    .discards {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        text-align: center;
    }
    h3.sentence {
        margin: 0;
        color: var(--rail-text, #514536);
        font-size: 14px;
        letter-spacing: 0;
        text-transform: none;
    }
    h3.sentence strong {
        font-size: 14px;
        font-weight: 650;
    }
    .note {
        margin: 0;
        color: var(--rail-muted, #887969);
        font-size: 12px;
    }
    .trains {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .train {
        --train-badge-font: 16px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        color: var(--rail-text, #514536);
        cursor: pointer;
    }
    .train[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .train:disabled {
        cursor: default;
    }
    .count {
        padding-right: 2px;
        font-size: 13px;
        font-weight: 600;
    }
    .confirm {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
    }
    .funding {
        text-align: center;
        font-size: 13px;
    }
    .funding .hint {
        margin-top: 6px;
        font-size: 12px;
    }
    .breakdown {
        margin: 0 auto 8px;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
    }
    .breakdown th,
    .breakdown td {
        padding: 2px 8px;
        color: var(--rail-text, #514536);
    }
    .breakdown th {
        font-weight: 400;
        text-align: left;
        color: var(--rail-muted, #887969);
    }
    .breakdown td {
        text-align: right;
    }
    .breakdown .total th,
    .breakdown .total td {
        padding-top: 5px;
        border-top: 1px solid var(--rail-border, #c7b8a6);
        color: var(--rail-text, #514536);
        font-weight: 700;
    }
    .sold {
        margin: 0 0 4px;
        color: var(--rail-muted, #887969);
        font-size: 12px;
    }
</style>
