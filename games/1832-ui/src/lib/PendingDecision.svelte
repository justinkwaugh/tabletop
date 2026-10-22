<script lang="ts">
    import { CompanyToken, DecisionResponse } from '@tabletop/18xx-ui'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = (amount: number) => session.presentation.money(amount)
    const shares = (count: number) => (count === 1 ? 'share' : 'shares')
</script>

<section class="centered-panel" aria-label="Pending decision">
    {#if session.redemptionPrompt}
        {@const request = session.redemptionPrompt}
        <DecisionResponse
            label="Redemption response"
            acceptLabel="Allow"
            disabled={session.busy || !session.canAnswerRedemption}
            onAccept={() => session.answerRedemption(true)}
            onDecline={() => session.answerRedemption(false)}
        >
            <CompanyToken appearance={session.mapView.stations[request.companyId]} size={24} />
            <strong>{request.companyName}</strong>
            <span>asks to redeem one of your shares for {money(request.price)}</span>
        </DecisionResponse>
    {/if}
    {#if session.protectionPrompt}
        {@const prompt = session.protectionPrompt}
        <DecisionResponse
            label="Price protection response"
            acceptLabel="Protect"
            disabled={session.busy || !session.canDecideProtection}
            onAccept={() => session.protectShares(prompt.companyId)}
            onDecline={() => session.declineProtection(prompt.companyId)}
        >
            <CompanyToken appearance={session.mapView.stations[prompt.companyId]} size={24} />
            <strong>{session.companyName(prompt.companyId)}</strong>
            <span
                >{session.getPlayerName(prompt.sellerPlayerId)} sold {prompt.shares}
                {shares(prompt.shares)} for {money(prompt.proceeds)}. Buy {prompt.shares === 1
                    ? 'it'
                    : 'them'} to keep the price at {money(
                    prompt.price
                )}?{#if prompt.declinedPrice !== prompt.price}{' '}Declining drops it to {money(
                        prompt.declinedPrice
                    )}.{/if}</span
            >
        </DecisionResponse>
    {/if}
</section>
