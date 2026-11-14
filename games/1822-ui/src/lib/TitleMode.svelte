<script lang="ts">
    import {
        BoxAcquisitionCost1822,
        LondonLocationId,
        MetropolitanId,
        TrainDepot1822,
        londonHomeCompanyIds1822,
        lotKind1822,
        private1822,
        type AcquisitionChoice1822,
        type TokenChoice1822
    } from '@tabletop/1822'
    import { placeReference } from '@tabletop/18xx'
    import { CompanyToken, PlaceText, counted } from '@tabletop/18xx-ui'
    import { LondonStationNames } from './history.js'
    import { lotName, lotStacks } from './lots.js'
    import type { Session1822 } from './session.svelte.js'

    let { session, id }: { session: Session1822; id: string } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(!session.canChooseAction)
    const companyId = $derived(
        session.gameState.trackStep?.companyId ?? session.gameState.trainPurchaseStep?.companyId
    )
    const company = $derived(companyId ? session.companyName(companyId) : 'The company')

    const trainName = (definitionId: string) => TrainDepot1822.trainDefinition(definitionId).name

    const PrivateChoiceLabels: Readonly<Record<AcquisitionChoice1822, string>> = {
        token: 'Token: one rough, hill or mountain lay free',
        discount: 'Standing £20 off hills and mountains',
        channel: 'Exchange token into the English Channel',
        upgrade:
            'Upgrade the English Channel for £100, as this turn’s track, and place an exchange token there',
        available: 'Exchange token to the available tokens'
    }
    const TokenLabels: Readonly<Record<TokenChoice1822, string>> = {
        place: 'Exchange token takes its station',
        available: 'Exchange token becomes available',
        none: 'No exchange token left'
    }
    const privateDraft = $derived(session.privateDraft)
    const draftedPrivate = $derived(
        session.privateOffers.find(
            (offer) => offer.privateCompanyId === privateDraft?.privateCompanyId
        )
    )
    const minorDraft = $derived(session.minorDraft)
    const acquisition = $derived(session.draftedAcquisition)
    const stacks = $derived(lotStacks(session.gameState).filter((stack) => stack.lotIds.length))

    function terms(shares: number, payment: number): string {
        const given = shares ? counted(shares, 'share') : 'No shares'
        if (payment === 0) return given
        return payment > 0
            ? `${given} and ${money(payment)}`
            : `${given}; the director pays back ${money(-payment)}`
    }
</script>

{#snippet token(markId: string, size = 26)}
    <CompanyToken appearance={session.mapView.stations[markId]} {size} />
{/snippet}

{#if id === 'metropolitan'}
    {@const station = session.metropolitanStation}
    <section class="mode title-panel" aria-label="Metropolitan Railway home">
        <p>
            <PlaceText
                text={`The Metropolitan Railway places its home beside one of ${placeReference(LondonLocationId)}’s six stations for ${money(session.metropolitanHomeCost)}. This is its track lay for the turn.`}
            />
        </p>
        {#if station}
            <p class="chosen-station">
                <PlaceText
                    text={`Beside ${placeReference(LondonLocationId)}’s ${LondonStationNames[station]} station`}
                />
                <span class="marks"
                    >{#each londonHomeCompanyIds1822(station) as homeId (homeId)}{@render token(
                            homeId,
                            20
                        )}{/each}</span
                >
            </p>
            <button
                class="action-button"
                disabled={!session.canPlaceMetropolitanHome}
                onclick={() => session.placeMetropolitanHome()}
                >Place its home for {money(session.metropolitanHomeCost)}</button
            >
            <small class="muted">Tap another London station to change it.</small>
        {:else}
            <p><strong>Tap a London station on the map.</strong></p>
        {/if}
    </section>
{:else if id === 'first-train' && session.firstTrain}
    {@const offer = session.firstTrain}
    <section class="mode title-panel" aria-label="First train">
        <p>
            As its first turn begins, {company} may buy an L-train so that it can run it this turn.
        </p>
        <button class="action-button" disabled={busy} onclick={() => session.buyLocalTrain()}
            >Buy an L-train for {money(offer.price)}</button
        >
    </section>
{:else if id === 'privates'}
    <section class="mode title-panel" aria-label="Private companies">
        {#if privateDraft && draftedPrivate}
            {@const entry = private1822(privateDraft.privateCompanyId)}
            <h3>{company} acquires {privateDraft.privateCompanyId} {entry?.name}</h3>
            {#if draftedPrivate.agreementPlayerId}
                <p>
                    {session.getPlayerName(draftedPrivate.agreementPlayerId)} holds it and answers; they
                    receive nothing for it.
                </p>
            {/if}
            {#if draftedPrivate.choices.length}
                <div class="choices" role="group" aria-label="How it is taken up">
                    {#each draftedPrivate.choices as choice (choice)}
                        <button
                            class="choice"
                            aria-pressed={privateDraft.choice === choice}
                            onclick={() => session.changePrivateTerms({ choice })}
                            >{PrivateChoiceLabels[choice]}</button
                        >
                    {/each}
                </div>
            {/if}
            {#if draftedPrivate.needsDiscard}
                <p>Its train takes {company} over its limit. Choose the train it discards.</p>
                <div class="choices" role="group" aria-label="Train to discard">
                    {#each session.limitedTrains as train (train.id)}
                        <button
                            class="choice"
                            aria-pressed={privateDraft.discardTrainId === train.id}
                            onclick={() => session.changePrivateTerms({ discardTrainId: train.id })}
                            >{trainName(train.definitionId)}</button
                        >
                    {/each}
                </div>
            {/if}
            <button
                class="action-button"
                disabled={busy}
                onclick={() => session.acquireChosenPrivate()}
                >{draftedPrivate.agreementPlayerId ? 'Ask for' : 'Acquire'}
                {privateDraft.privateCompanyId}</button
            >
        {:else if session.stackCard}
            <h3>Move {lotName(session.stackCard)}</h3>
            <p>P17 closes once the certificate has moved.</p>
            <div class="choices">
                <button
                    class="action-button"
                    disabled={busy}
                    onclick={() => session.moveStackCard('top')}>To the top of its stack</button
                >
                <button
                    class="action-button"
                    disabled={busy}
                    onclick={() => session.moveStackCard('bottom')}
                    >To the bottom of its stack</button
                >
            </div>
        {:else}
            {#if session.privateOffers.length}
                <h3>{company} may take private companies from the players holding them</h3>
                <ul class="offers">
                    {#each session.privateOffers as offer (offer.privateCompanyId)}
                        {@const entry = private1822(offer.privateCompanyId)}
                        <li>
                            <span class="number">{offer.privateCompanyId}</span>
                            <span class="offer-text"
                                ><strong>{entry?.power}</strong><span class="muted"
                                    >{entry?.name}{offer.agreementPlayerId
                                        ? ` · held by ${session.getPlayerName(offer.agreementPlayerId)}, who must agree`
                                        : ''}</span
                                ></span
                            >
                            <button
                                class="choice"
                                disabled={busy}
                                onclick={() => session.choosePrivate(offer)}
                                >{offer.agreementPlayerId ? 'Ask' : 'Acquire'}</button
                            >
                        </li>
                    {/each}
                </ul>
            {/if}
            {#if session.discountTokens.length}
                <h3>Discount tokens</h3>
                <div class="choices">
                    {#each session.discountTokens as kind (kind)}
                        <button
                            class="choice"
                            disabled={busy}
                            onclick={() => session.useDiscountToken(kind)}
                            >{kind === 'terrain'
                                ? 'Pay the next rough, hill or mountain lay with the token'
                                : 'Pay the next estuary crossings with the tokens'}</button
                        >
                    {/each}
                </div>
            {/if}
            {#if session.stationSwaps.length}
                <h3>P18 moves one station token, then closes</h3>
                <div class="choices">
                    {#each session.stationSwaps as direction (direction)}
                        <button
                            class="choice"
                            disabled={busy}
                            onclick={() => session.swapStationToken(direction)}
                            >{direction === 'to-available'
                                ? 'An exchange token becomes available'
                                : 'An available token joins the exchange tokens'}</button
                        >
                    {/each}
                </div>
            {/if}
            {#if session.movableStackCards.length}
                <h3>P17 moves one certificate within its stack, then closes</h3>
                {#each stacks as stack (stack.id)}
                    <div class="stack">
                        <span class="muted">{stack.label}</span>
                        <div class="choices" role="group" aria-label={stack.label}>
                            {#each stack.lotIds as lotId (lotId)}
                                <button
                                    class="choice small"
                                    disabled={busy}
                                    onclick={() => session.chooseStackCard(lotId)}
                                    >{lotKind1822(lotId) === 'private'
                                        ? `${lotId} ${private1822(lotId)?.power ?? ''}`
                                        : lotName(lotId)}</button
                                >
                            {/each}
                        </div>
                    </div>
                {/each}
            {/if}
        {/if}
    </section>
{:else if id === 'acquire-minor'}
    <section class="mode title-panel" aria-label="Acquire a minor company">
        {#if minorDraft && acquisition}
            <h3>
                {company} acquires {session.companyName(minorDraft.minorId)}
                {acquisition.source === 'box'
                    ? 'from the bidding boxes'
                    : acquisition.agreementPlayerId
                      ? `from ${session.getPlayerName(acquisition.agreementPlayerId)}`
                      : 'from its director'}
            </h3>
            {#if acquisition.agreementPlayerId}
                <p>
                    {session.getPlayerName(acquisition.agreementPlayerId)} directs it and answers your
                    offer. If they decline, {company} makes no other offer for it this turn.
                </p>
            {/if}
            {#if acquisition.terms.length > 1}
                <div class="choices" role="group" aria-label="What its director receives">
                    {#each acquisition.terms as offer (offer.shares)}
                        <button
                            class="choice"
                            aria-pressed={minorDraft.shares === offer.shares}
                            onclick={() => session.changeMinorTerms({ shares: offer.shares })}
                            >{terms(offer.shares, offer.payment)}</button
                        >
                    {/each}
                </div>
            {:else}
                {@const [only] = acquisition.terms}
                <p>
                    {acquisition.source === 'box'
                        ? `${company} pays the bank ${money(BoxAcquisitionCost1822)}.`
                        : `Its director receives: ${only ? terms(only.shares, only.payment).toLowerCase() : 'nothing'}.`}
                </p>
            {/if}
            {#if acquisition.londonNodeIds}
                <div class="choices" role="group" aria-label="London station">
                    {#each acquisition.londonNodeIds as nodeId (nodeId)}
                        <button
                            class="choice"
                            aria-pressed={minorDraft.nodeId === nodeId}
                            onclick={() => session.changeMinorTerms({ nodeId })}
                            >London {LondonStationNames[nodeId]}</button
                        >
                    {/each}
                </div>
            {/if}
            <div class="choices" role="group" aria-label="Exchange token">
                {#each acquisition.tokens as choice (choice)}
                    <button
                        class="choice"
                        aria-pressed={minorDraft.token === choice}
                        disabled={choice === 'none'}
                        onclick={() => session.changeMinorTerms({ token: choice })}
                        >{TokenLabels[choice]}</button
                    >
                {/each}
            </div>
            {#if acquisition.excessTrains}
                <p>
                    With the minor’s trains {company} is over its limit: discard
                    {acquisition.excessTrains === 1
                        ? 'one train'
                        : `${acquisition.excessTrains} trains`}
                    to the bank pool.
                </p>
                <div class="choices" role="group" aria-label="Trains to discard">
                    {#each session.acquisitionTrains as train (train.id)}
                        <button
                            class="choice"
                            aria-pressed={minorDraft.discardTrainIds.includes(train.id)}
                            onclick={() => session.toggleMinorDiscard(train.id)}
                            >{trainName(train.definitionId)}</button
                        >
                    {/each}
                </div>
            {/if}
            <button
                class="action-button"
                disabled={busy || !session.canAcquireMinor}
                onclick={() => session.acquireMinor()}
                >{acquisition.agreementPlayerId ? 'Offer for' : 'Acquire'}
                {session.companyInitials(minorDraft.minorId)}</button
            >
        {:else}
            <p>
                After buying trains, {company} may acquire one minor company its track reaches. It buys
                no more trains this turn once it has.
            </p>
            <ul class="offers">
                {#each session.minorAcquisitions as offer (offer.minorId)}
                    <li>
                        {@render token(offer.minorId)}
                        <span class="offer-text"
                            ><strong>{session.companyName(offer.minorId)}</strong><span
                                class="muted"
                                >{offer.source === 'box'
                                    ? `In the bidding boxes, for ${money(BoxAcquisitionCost1822)}`
                                    : `${
                                          offer.agreementPlayerId
                                              ? `From ${session.getPlayerName(offer.agreementPlayerId)}, if they agree`
                                              : 'From its director'
                                      }, ${
                                          offer.minorId === MetropolitanId
                                              ? 'with its London home'
                                              : 'for twice its share value'
                                      }`}</span
                            ></span
                        >
                        <button
                            class="choice"
                            disabled={busy}
                            onclick={() => session.chooseMinor(offer)}
                            >{offer.agreementPlayerId ? 'Offer' : 'Acquire'}</button
                        >
                    </li>
                {/each}
            </ul>
        {/if}
    </section>
{/if}

<style>
    .mode {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--rail-text, #443c34);
    }
    p {
        margin: 0;
        max-width: 36em;
        text-align: center;
    }
    h3 {
        margin: 4px 0 0;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
    }
    .muted {
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .choice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 30px;
        padding: 3px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #faf7f1);
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .choice.small {
        min-height: 24px;
        padding: 1px 7px;
        font-size: 11px;
    }
    .choice:hover:enabled {
        border-color: var(--rail-focus, #443e35);
    }
    .choice[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-raised, #eae1d5);
        font-weight: 600;
    }
    .choice:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .chosen-station {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 600;
    }
    .marks {
        display: inline-flex;
        gap: 2px;
    }
    .offers {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: min(100%, 460px);
    }
    .offers li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface-raised, #eae1d5);
    }
    .offer-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        line-height: 1.25;
    }
    .number {
        flex: none;
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #faf7f1);
        font-size: 11px;
        font-weight: 700;
    }
    .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
    }
    .action-button {
        padding: 6px 14px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
    }
    .action-button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
