<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { powerKey } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    // R-5.5.2.a then R-5.5.3 — the Citizens asked to join have answered; the attacker's plans come next.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.attackPlans)
    let busy = $derived(gameSession.busy)
    const plansWidth = new ChoiceWidth()
    let mine = $derived(
        draft.attackerId !== undefined && draft.attackerId === gameSession.myPlayer?.id
    )
    let useRefusedBecause = $derived(mine ? draft.usePlansRefusedBecause : undefined)
    let noneRefusedBecause = $derived(mine ? draft.noPlansRefusedBecause : undefined)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-2">Battle plans</h3>
    {#if !mine}
        <WaitingOn />
    {:else}
        {#if draft.usable.length > 0}
            <p class="text-sm mb-2">Tap the plans to use.</p>
        {/if}
        <div class="mb-1">
            <CardChoiceRow
                choices={powerUseCards(draft.usable)}
                picked={draft.usable
                    .filter((power) => draft.isDeclared(power))
                    .map((power) => powerKey(power.cardId, power.powerIndex))}
                onpick={(key) => {
                    const power = draft.usable.find((p) => powerKey(p.cardId, p.powerIndex) === key)
                    if (power) draft.setPlan(power, !draft.isDeclared(power))
                }}
                {busy}
                height={90}
            />
        </div>
        {#each draft.usable as power (powerKey(power.cardId, power.powerIndex))}
            {@const choices = draft.planChoicesOf(power)}
            {#if draft.isDeclared(power) && choices.length > 0}
                <div class="mb-1">
                    <div class="text-xs text-oath-text-muted">{cardName(power.cardId)}:</div>
                    <PowerChoicePicker
                        {choices}
                        bind:picks={
                            () => draft.planPicksOf(power),
                            (picks) => draft.setPlanPicks(power, picks)
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
        <!-- One width for the two, the wider one's; one per line when they do not fit. The confirm is the primary. -->
        <div class="flex flex-wrap gap-2">
            {#if draft.plansComplete && !useRefusedBecause}
                <button
                    class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    style:min-width="{plansWidth.widest}px"
                    disabled={busy}
                    onclick={() => draft.declare(true)}
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
                    onclick={() => draft.declare(false)}
                >
                    <span class="inline-block w-max" {@attach plansWidth.measure}>No plans</span>
                </button>
            {/if}
        </div>
    {/if}
</div>
