<script lang="ts">
    import { CompanyToken, DecisionResponse } from '@tabletop/18xx-ui'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const companyName = (companyId: string) =>
        session.presentation.companyNames?.[companyId]?.initials ?? companyId
    const money = (amount: number) => session.presentation.money(amount)
    const shares = (count: number) => (count === 1 ? 'share' : 'shares')
</script>

{#if session.redemptionPrompt}
    {@const request = session.redemptionPrompt}
    {#if session.canAnswerRedemption}
        <DecisionResponse
            label="Redemption response"
            acceptLabel="Allow"
            disabled={session.busy}
            onAccept={() => session.answerRedemption(true)}
            onDecline={() => session.answerRedemption(false)}
        >
            <CompanyToken appearance={session.mapView.stations[request.companyId]} size={24} />
            <strong>{request.companyName}</strong>
            <span>asks to redeem one of your shares for {money(request.price)}</span>
        </DecisionResponse>
    {:else}
        <header class="title-prompt">
            <span
                >{session.getPlayerName(request.holderPlayerId)} may allow {request.companyName} to redeem
                their share</span
            >
        </header>
    {/if}
{/if}
{#if session.protectionPrompt}
    {@const prompt = session.protectionPrompt}
    {#if session.canDecideProtection}
        <DecisionResponse
            label="Price protection response"
            acceptLabel="Protect"
            disabled={session.busy}
            onAccept={() => session.protectShares(prompt.companyId)}
            onDecline={() => session.declineProtection(prompt.companyId)}
        >
            <CompanyToken appearance={session.mapView.stations[prompt.companyId]} size={24} />
            <strong>{session.companyName(prompt.companyId)}</strong>
            <span
                >{session.getPlayerName(prompt.sellerPlayerId)} sold {prompt.shares}
                {shares(prompt.shares)} for {money(prompt.proceeds)}. Buy {prompt.shares === 1
                    ? 'it'
                    : 'them'} to protect the price, returning it to {money(
                    prompt.restoredPrice
                )}?</span
            >
        </DecisionResponse>
    {:else}
        <header class="title-prompt">
            <span
                >{session.getPlayerName(prompt.presidentPlayerId)} may protect the {companyName(
                    prompt.companyId
                )} price</span
            >
        </header>
    {/if}
{/if}

{#if session.keyWestChoice && session.canChooseAction}
    <header class="title-prompt">
        <span>Place the Key West token in Miami instead of a station?</span>
        <button
            class="action-button inline-action"
            onclick={() => session.keyWestChoice && session.placeRevenueToken(session.keyWestChoice)}
            >place</button
        >
    </header>
{/if}
{#if session.canBuyCoalRights}
    <header class="title-prompt">
        <span>Buy a West Virginia Coal Fields token for $80, using a yellow tile lay?</span>
        <button class="action-button inline-action" onclick={() => session.buyCoalRights()}
            >buy</button
        >
    </header>
{/if}
{#if session.londonCompanies.length}
    <header class="title-prompt">
        <span>London Investment Company: take a free share of</span>
        <span class="choices"
            >{#each session.londonCompanies as { companyId, certificateId } (companyId)}<button
                    class="action-button inline-action"
                    onclick={() => session.takeLondonShare(certificateId)}
                    >{companyName(companyId)}</button
                >{/each}</span
        >
    </header>
{/if}

<style>
    .title-prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .title-prompt button {
        margin: 0;
    }
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
