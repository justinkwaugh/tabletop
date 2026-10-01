<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { powerKey } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason } from '$lib/model/names.js'

    // R-5.5.3, R-7.5.2 — the defending side's battle plans, answered knowing
    // the pools and not the roll. R-5.5.3.a: the defender first, then each ally.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let campaign = $derived.by(() => {
        const campaign = gameState.campaign
        assertExists(campaign, 'Battle plans are answered mid-Campaign')
        return campaign
    })
    let myId = $derived(gameSession.myPlayer?.id)
    let defence = $derived(gameSession.defence)
    let answeringId = $derived(defence.answeringPlayerId)
    let isAnswering = $derived(!!myId && answeringId === myId)
    let ally = $derived(
        answeringId !== undefined && answeringId !== campaign.defenderPlayerId
            ? { name: gameSession.getPlayerName(answeringId), defender: defenderName() }
            : undefined
    )
    let attackerName = $derived(gameSession.getPlayerName(campaign.attackerPlayerId))

    function defenderName(): string {
        const defenderId = campaign.defenderPlayerId
        assertExists(defenderId, 'Allies answer only for a defending player')
        return gameSession.getPlayerName(defenderId)
    }

    let usable = $derived(defence.usable)
    let plans = $derived(defence.plans)
    let busy = $derived(gameSession.busy)

    let blockedBecause = $derived(defence.blockedBecause)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-2">
        Campaign — battle plans
    </h3>

    <div class="text-sm mb-2 flex gap-4">
        <span>Attack dice <span class="font-semibold">{campaign.attackPool}</span></span>
        <span>Defense dice <span class="font-semibold">{campaign.defensePool}</span></span>
    </div>
    {#if campaign.plansUsed.length > 0}
        <p class="text-[11px] text-oath-text-muted mb-2">
            {attackerName} used: {campaign.plansUsed.map(cardName).join(', ')}
        </p>
    {/if}

    {#if isAnswering}
        <p class="text-sm mb-2">
            {#if ally}
                You are {ally.defender}'s ally. Use any defender's battle plans you rule, once each.
            {:else}
                You are defending. Use any battle plans you rule, once each, then roll.
            {/if}
        </p>
        <div class="mb-1">
            <CardChoiceRow
                choices={powerUseCards(usable)}
                picked={usable
                    .filter((power) => defence.isDeclared(power))
                    .map((power) => powerKey(power.cardId, power.powerIndex))}
                onpick={(key) => {
                    const power = usable.find((p) => powerKey(p.cardId, p.powerIndex) === key)
                    if (power) defence.setPlan(power, !defence.isDeclared(power))
                }}
                {busy}
                height={90}
            />
        </div>
        {#each usable as power (powerKey(power.cardId, power.powerIndex))}
            {@const choices = defence.planChoicesOf(power)}
            {#if defence.isDeclared(power) && choices.length > 0}
                <div class="mb-1">
                    <div class="text-xs text-oath-text-muted">{cardName(power.cardId)}:</div>
                    <PowerChoicePicker
                        {choices}
                        bind:picks={
                            () => defence.planPicksOf(power),
                            (picks) => defence.setPlanPicks(power, picks)
                        }
                    />
                </div>
            {/if}
        {/each}
        {#if blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">{humanizeReason(blockedBecause)}</p>
        {/if}
        <button
            class="w-full rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                   px-2 py-1.5 text-sm font-semibold"
            disabled={busy || !!blockedBecause}
            onclick={() => defence.answer()}
        >
            {plans.length > 0 ? `Use ${plans.length} and roll` : 'Use none and roll'}
        </button>
    {:else}
        <p class="text-sm text-oath-text-muted">
            {#if ally}
                Waiting for {ally.name}, {ally.defender}'s ally, to use battle plans.
            {:else}
                Waiting for the defender to use their battle plans.
            {/if}
        </p>
    {/if}
</div>
