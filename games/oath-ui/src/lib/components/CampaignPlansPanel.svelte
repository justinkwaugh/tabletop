<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { powerKey } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'

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
            ? { defender: defenderName() }
            : undefined
    )

    function defenderName(): string {
        const defenderId = campaign.defenderPlayerId
        assertExists(defenderId, 'Allies answer only for a defending player')
        return gameSession.getPlayerName(defenderId)
    }

    let usable = $derived(defence.usable)
    let busy = $derived(gameSession.busy)

    let useRefusedBecause = $derived(defence.usePlansRefusedBecause)
    let noneRefusedBecause = $derived(defence.noPlansRefusedBecause)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-2">Battle plans</h3>

    <div class="text-sm mb-2 flex gap-4">
        <span>Attack dice <span class="font-semibold">{campaign.attackPool}</span></span>
        <span>Defense dice <span class="font-semibold">{campaign.defensePool}</span></span>
    </div>
    {#if isAnswering}
        {#if usable.length > 0}
            <p class="text-sm mb-2">Tap the plans to use.</p>
        {/if}
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
        <!-- Use plans waits for a plan and its picks; a refusal takes the button's place. -->
        {#if useRefusedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(useRefusedBecause) ?? ''} />
            </p>
        {/if}
        {#if noneRefusedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(noneRefusedBecause) ?? ''} />
            </p>
        {/if}
        <!-- One width for the two, the wider one's. -->
        <div class="inline-grid auto-cols-fr grid-flow-col gap-2">
            {#if defence.plansComplete && !useRefusedBecause}
                <button
                    class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    disabled={busy}
                    onclick={() => defence.answer(true)}
                >
                    Use plans
                </button>
            {/if}
            {#if !noneRefusedBecause}
                <button
                    class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-3 py-1.5 text-sm
                           max-sm:min-h-11"
                    disabled={busy}
                    onclick={() => defence.answer(false)}
                >
                    No plans
                </button>
            {/if}
        </div>
    {:else}
        <WaitingOn />
    {/if}
</div>
