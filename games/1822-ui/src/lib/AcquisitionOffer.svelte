<script lang="ts">
    import { private1822 } from '@tabletop/1822'
    import { CompanyToken, counted } from '@tabletop/18xx-ui'
    import type { Session1822 } from './session.svelte.js'

    let { session }: { session: Session1822 } = $props()
    const money = $derived(session.presentation.money)
    const offer = $derived(session.acquisitionOffer)
    const request = $derived(session.privateOffer)
</script>

{#if request}
    {@const company = session.companyName(request.companyId)}
    {@const held = private1822(request.privateCompanyId)}
    <section class="offer title-panel centered-panel" aria-label="Request for a private company">
        <h3>
            <CompanyToken appearance={session.mapView.stations[request.companyId]} size={24} />
            {company} asks for {request.privateCompanyId}
            {held?.name}
        </h3>
        {#if session.canAnswerPrivateOffer}
            <ul>
                <li>{company} takes {request.privateCompanyId}: {held?.power}.</li>
                <li>
                    You receive nothing for it, and it no longer counts as one of your certificates.
                </li>
            </ul>
            <div class="choices">
                <button class="action-button" onclick={() => session.answerPrivateOffer(true)}
                    >Let {session.companyInitials(request.companyId)} have it</button
                >
                <button class="choice" onclick={() => session.answerPrivateOffer(false)}
                    >Keep it</button
                >
            </div>
        {:else}
            <p>
                {session.getPlayerName(request.playerId)} holds {request.privateCompanyId} and is answering.
            </p>
        {/if}
    </section>
{/if}

{#if offer}
    {@const major = session.companyName(offer.companyId)}
    {@const minor = session.companyName(offer.minorId)}
    {@const shares = offer.shares ? counted(offer.shares, 'share') : undefined}
    <section class="offer title-panel centered-panel" aria-label="Offer for a minor company">
        <h3>
            <CompanyToken appearance={session.mapView.stations[offer.companyId]} size={24} />
            {major} offers to acquire
            <CompanyToken appearance={session.mapView.stations[offer.minorId]} size={24} />
            {minor}
        </h3>
        {#if session.canAnswerAcquisition}
            <ul>
                {#if shares}<li>You receive {shares} of {major}.</li>{/if}
                {#if offer.payment > 0}
                    <li>{major} pays you {money(offer.payment)}.</li>
                {:else if offer.payment < 0}
                    <li>You pay {major} {money(-offer.payment)}.</li>
                {/if}
                <li>{minor} closes; its treasury, trains and private companies pass to {major}.</li>
            </ul>
            <div class="choices">
                <button class="action-button" onclick={() => session.answerAcquisition(true)}
                    >Accept</button
                >
                <button class="choice" onclick={() => session.answerAcquisition(false)}
                    >Decline</button
                >
            </div>
        {:else}
            <p>
                {session.getPlayerName(offer.playerId)} directs {minor} and is answering the offer{shares
                    ? ` of ${shares}`
                    : ''}{offer.payment > 0
                    ? `${shares ? ' and' : ' of'} ${money(offer.payment)}`
                    : offer.payment < 0
                      ? `, paying back ${money(-offer.payment)}`
                      : ''}.
            </p>
        {/if}
    </section>
{/if}

<style>
    .offer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--rail-text, #443c34);
    }
    h3 {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 0;
        font-size: 13px;
        font-weight: 600;
    }
    p,
    ul {
        margin: 0;
        max-width: 36em;
    }
    p {
        text-align: center;
    }
    ul {
        padding-left: 18px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .action-button,
    .choice {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
    }
    .action-button {
        border: 1px solid transparent;
    }
    .choice {
        border: 1px solid var(--rail-border, #c7b8a6);
        background: var(--rail-surface, #faf7f1);
        color: inherit;
    }
    .choice:hover {
        border-color: var(--rail-focus, #443e35);
    }
</style>
