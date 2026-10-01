<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { powerKey } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason } from '$lib/model/names.js'

    // R-5.5.2.a then R-5.5.3 — the Citizens asked to join have answered; the attacker's plans come next.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.attackPlans)
    let busy = $derived(gameSession.busy)
    let mine = $derived(
        draft.attackerId !== undefined && draft.attackerId === gameSession.myPlayer?.id
    )
    let reason = $derived(mine ? draft.blockedBecause : undefined)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-2">
        Campaign — the attacker's battle plans
    </h3>
    {#if !mine}
        <p class="text-sm text-oath-text-muted">
            Waiting for {draft.attackerId
                ? gameSession.getPlayerName(draft.attackerId)
                : 'the attacker'}
            to choose battle plans.
        </p>
    {:else}
        <p class="text-sm mb-2">
            The Citizens have answered. Use any battle plans you rule, once each.
        </p>
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
        {#if reason}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={humanizeReason(reason) ?? ''} />
            </p>
        {/if}
        <button
            class="w-full rounded bg-oath-danger-soft border border-oath-danger/60 text-oath-text hover:border-oath-danger disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
            disabled={busy || !!reason}
            onclick={() => draft.declare()}
        >
            {draft.plans.length > 0 ? 'Use these plans' : 'Use no plans'}
        </button>
    {/if}
</div>
