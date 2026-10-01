<script lang="ts">
    import {
        CampaignTargetKind,
        type CampaignDefender,
        type CampaignTarget,
        powerKey
    } from '@tabletop/oath'
    import AttackDiceRow from '$lib/components/AttackDiceRow.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'
    import {
        campaignTargetText,
        cardName,
        humanizeReason,
        relicSiteName,
        siteName
    } from '$lib/model/names.js'

    // The draft lives on the session, because the board's site layer toggles targets.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.campaign)
    let defender = $derived(draft.defender)
    let busy = $derived(gameSession.busy)

    function defenderLabel(candidate: CampaignDefender): string {
        return candidate.kind === 'bandits'
            ? 'The bandits'
            : gameSession.getPlayerName(candidate.playerId)
    }

    function targetLabel(target: CampaignTarget): string {
        const text = campaignTargetText(target, {
            site: (siteId) => siteName(gameState, siteId),
            relicSlot: (slotId) => relicSiteName(gameState, slotId)
        })
        return target.kind === CampaignTargetKind.SiteRelic ? `${text} (+1 die)` : text
    }
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        Campaign
        <span class="ml-2 normal-case tracking-normal text-oath-text-muted">
            {draft.supplyCost === 0 ? 'no Supply' : `${draft.supplyCost} Supply`}
        </span>
    </h3>

    {#if !defender}
        <p class="text-sm mb-1">Choose who you are attacking.</p>
        <div class="flex flex-col gap-1">
            {#each draft.defenderOptions as candidate (defenderLabel(candidate))}
                <button
                    class="rounded border border-oath-frame bg-oath-surface-raised
                           hover:border-oath-accent disabled:opacity-40 px-2 py-1 text-sm text-left"
                    disabled={busy}
                    onclick={() => draft.chooseDefender(candidate)}
                >
                    {defenderLabel(candidate)}
                </button>
            {/each}
        </div>
    {:else}
        {#if draft.defenderFixed && defender.kind === 'player'}
            <p class="text-sm mb-1">
                Sneak Attack: the defender is {gameSession.getPlayerName(defender.playerId)}.
            </p>
        {/if}
        <p class="text-sm mb-1">
            Choose what to take — tap sites on the map, or the list here. The rules constrains the
            set, so a target may be unavailable because of what is already chosen.
        </p>
        <div class="flex flex-col gap-1 mb-2">
            {#each draft.targetOptions as target (JSON.stringify(target))}
                {@const chosen = draft.hasTarget(target)}
                {@const legal = draft.canToggleTarget(target)}
                <button
                    class="rounded border px-2 py-1 text-sm text-left
                           {chosen
                        ? 'border-oath-accent bg-oath-accent-soft'
                        : legal
                          ? 'border-oath-divider bg-oath-surface-raised hover:border-oath-accent'
                          : 'border-oath-divider bg-oath-surface opacity-45'}"
                    disabled={busy || (!chosen && !legal)}
                    onclick={() => draft.toggleTarget(target)}
                >
                    {chosen ? '✓ ' : ''}{targetLabel(target)}
                </button>
            {/each}
        </div>

        <div class="mb-2 text-sm">
            <div class="mb-1">Attack dice — tap to set the pool</div>
            <AttackDiceRow />
        </div>

        {#if draft.lossSources.length > 1}
            <!-- R-5.5.5, R-10.22 — the attacker chooses where the skulls' kills come from. -->
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1 text-oath-text-muted">Skulls kill your warbands from, in order:</div>
                {#each draft.lossOrder as source, index (JSON.stringify(source))}
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="grow"
                            >{gameSession.warbandOwnerName(source.owner)}
                            {source.at.kind === 'board'
                                ? 'on your board'
                                : `at ${siteName(gameState, source.at.siteId)}`}</span
                        >
                        {#if index > 0}
                            <button
                                type="button"
                                class="rounded bg-oath-control hover:bg-oath-control-hover px-2 py-0.5"
                                disabled={busy}
                                onclick={() => draft.moveLossSourceUp(index)}
                            >
                                ↑
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        {#if draft.plansWaitForAllies}
            <p class="mb-2 text-[11px] text-oath-text-muted">
                A Citizen may join the defence, so your battle plans are chosen after they answer.
            </p>
        {/if}
        {#if draft.planOptions.length > 0}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1 text-oath-text-muted">Battle plans to use:</div>
                <CardChoiceRow
                    choices={powerUseCards(draft.planOptions)}
                    picked={draft.planOptions
                        .filter((power) => draft.isPlanDeclared(powerUseKey(power)))
                        .map((power) => powerKey(power.cardId, power.powerIndex))}
                    onpick={(key) => {
                        const power = draft.planOptions.find(
                            (p) => powerKey(p.cardId, p.powerIndex) === key
                        )
                        if (power) {
                            const use = powerUseKey(power)
                            draft.declarePlan(use, !draft.isPlanDeclared(use))
                        }
                    }}
                    {busy}
                    height={90}
                />
                {#each draft.planOptions as power (powerKey(power.cardId, power.powerIndex))}
                    {@const use = powerUseKey(power)}
                    {@const choices = draft.planChoicesOf(power)}
                    {#if draft.isPlanDeclared(use) && choices.length > 0}
                        <div class="mt-1 mb-1">
                            <div class="text-oath-text-muted">{cardName(power.cardId)}:</div>
                            <PowerChoicePicker
                                {choices}
                                bind:picks={
                                    () => draft.planPicksOf(use),
                                    (picks) => draft.setPlanPicks(use, picks)
                                }
                            />
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}

        {#if draft.blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                {humanizeReason(draft.blockedBecause)}
            </p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !draft.declarable}
                onclick={() => draft.declare()}
            >
                Declare the Campaign
            </button>
            {#if draft.hasManualSelection()}
                <button
                    class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-1.5 text-sm"
                    disabled={busy}
                    onclick={() => gameSession.back()}
                >
                    Back
                </button>
            {/if}
        </div>
    {/if}
</div>
