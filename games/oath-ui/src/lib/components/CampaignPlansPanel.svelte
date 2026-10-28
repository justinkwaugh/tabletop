<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import PlanRows from '$lib/components/PlanRows.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import PowerMovesPicker from '$lib/components/PowerMovesPicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { powerKey } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { pickerWords } from '$lib/model/powerPickerWords.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { movesShown } from '$lib/model/powerMoves.js'

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
    const plansWidth = new ChoiceWidth()

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
            <PlanRows
                plans={usable}
                isOn={(power) => defence.isDeclared(power)}
                toggle={(power) => defence.setPlan(power, !defence.isDeclared(power))}
                {busy}
            />
        </div>
        {#each usable as power (powerKey(power.cardId, power.powerIndex))}
            {@const choices = defence.planChoicesOf(power)}
            {@const moves = defence.movesOf(power)}
            <!-- Warning Signals with no warband it can move asks nothing. -->
            {#if defence.isDeclared(power) && choices.length > 0 && (!moves || movesShown(moves))}
                <div class="mb-1" data-plan-picks={power.cardId}>
                    <div class="text-xs text-oath-text-muted">{cardName(power.cardId)}:</div>
                    <!-- Warning Signals' moves are Messenger's: one at a time, as tiles and warband pieces. -->
                    {#if moves}
                        <PowerMovesPicker
                            {moves}
                            picks={defence.planPicksOf(power).moves}
                            onchange={(picks) => defence.setMoves(power, picks)}
                        />
                    {:else}
                        <PowerChoicePicker
                            {choices}
                            bind:picks={
                                () => defence.planPicksOf(power),
                                (picks) => defence.setPlanPicks(power, picks)
                            }
                            words={pickerWords(power.cardId)}
                        />
                    {/if}
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
        <!-- One width for the two, the wider one's; one per line when the two do not fit. -->
        <div class="flex flex-wrap gap-2">
            {#if defence.plansComplete && !useRefusedBecause}
                <button
                    class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    style:min-width="{plansWidth.widest}px"
                    disabled={busy}
                    onclick={() => defence.answer(true)}
                >
                    <span class="inline-block w-max" {@attach plansWidth.measure}>Use plans</span>
                </button>
            {/if}
            {#if !noneRefusedBecause}
                <button
                    class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-3 py-1.5 text-sm
                           max-sm:min-h-11"
                    style:min-width="{plansWidth.widest}px"
                    disabled={busy}
                    onclick={() => defence.answer(false)}
                >
                    <span class="inline-block w-max" {@attach plansWidth.measure}>No plans</span>
                </button>
            {/if}
        </div>
    {:else}
        <WaitingOn />
    {/if}
</div>
