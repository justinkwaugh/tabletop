<script lang="ts">
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import DecisionResponse from '../finance/DecisionResponse.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { MoneyFormat } from '../presentation/money.js'
    import type { ShareActions } from './shareActions.svelte.js'
    let {
        session,
        actions
    }: {
        session: {
            readonly presentation: { money: MoneyFormat }
            readonly busy: boolean
            readonly mapView: { stations: Readonly<Record<string, StationAppearance>> }
            companyName(companyId: string): string
            getPlayerName(playerId: string): string
        }
        actions: Pick<
            ShareActions<never>,
            | 'redemptionPrompt'
            | 'protectionPrompt'
            | 'canAnswerRedemption'
            | 'canDecideProtection'
            | 'answerRedemption'
            | 'protectShares'
            | 'declineProtection'
        >
    } = $props()
    const money = (amount: number) => session.presentation.money(amount)
    const shares = (count: number) => (count === 1 ? 'share' : 'shares')
</script>

<section class="centered-panel" aria-label="Pending decision">
    {#if actions.redemptionPrompt}
        {@const request = actions.redemptionPrompt}
        <DecisionResponse
            label="Redemption response"
            acceptLabel="Allow"
            disabled={session.busy || !actions.canAnswerRedemption}
            onAccept={() => actions.answerRedemption(true)}
            onDecline={() => actions.answerRedemption(false)}
        >
            <CompanyToken appearance={session.mapView.stations[request.companyId]} size={24} />
            <strong>{request.companyName}</strong>
            <span>asks to redeem one of your shares for {money(request.price)}</span>
        </DecisionResponse>
    {/if}
    {#if actions.protectionPrompt}
        {@const prompt = actions.protectionPrompt}
        <DecisionResponse
            label="Price protection response"
            acceptLabel="Protect"
            disabled={session.busy || !actions.canDecideProtection}
            onAccept={() => actions.protectShares(prompt.companyId)}
            onDecline={() => actions.declineProtection(prompt.companyId)}
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
