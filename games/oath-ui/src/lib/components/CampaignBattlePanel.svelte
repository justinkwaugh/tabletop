<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import { MachineState, type WarbandGroup } from '@tabletop/oath'
    import SpoilsSteps from '$lib/components/SpoilsSteps.svelte'
    import StepHeading from '$lib/components/StepHeading.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import WarbandGroupRows from '$lib/components/WarbandGroupRows.svelte'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ownForcePlaceName, siteName } from '$lib/model/names.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    // R-5.5.5's sacrifice, then R-5.5.7's spoils: each needs the roll, or the surviving force, first.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let campaign = $derived.by(() => {
        const campaign = gameState.campaign
        assertExists(campaign, 'The battle is fought mid-Campaign')
        return campaign
    })
    let attackerId = $derived(campaign.attackerPlayerId)
    let isAttacker = $derived(gameSession.myPlayer?.id === attackerId)

    // The heading names the step; the turn bar names whose turn it is.
    let heading = $derived(
        gameState.machineState === MachineState.CampaignDefeat
            ? 'Losses'
            : gameState.machineState === MachineState.CampaignVictory
              ? 'Spoils'
              : 'Battle'
    )

    let busy = $derived(gameSession.busy)

    // R-5.5.7 — the spoils' steps shown, as dots and "N of M", when there is more than one.
    let spoils = $derived(gameSession.victory)
    let spoilsSteps = $derived(
        isAttacker && gameState.machineState === MachineState.CampaignVictory
            ? spoils.steps.length
            : 0
    )

    // R-5.5.5.b, R-5.5.5.c — the exact winning sacrifice, or zero.
    let losses = $derived(gameSession.attackerLosses)
    let needed = $derived(losses.needed)

    let defeat = $derived(gameSession.defeat)
    let chooserId = $derived(campaign.pendingDefeatKills?.chooserPlayerId)
    let iChooseLosses = $derived(!!chooserId && gameSession.myPlayer?.id === chooserId)

    /** The force's groups by their index in it, a board's before the sites'. */
    function boardFirst(groups: readonly WarbandGroup[]): number[] {
        const indices = groups.map((_, index) => index)
        return [
            ...indices.filter((index) => groups[index].at.kind === 'board'),
            ...indices.filter((index) => groups[index].at.kind !== 'board')
        ]
    }

    // R-5.5.5 — from revision 7 the attacker picks where the skulls kill, after the roll.
    let skullLosses = $derived(gameSession.skullLosses)

    let winRefusedBecause = $derived(losses.winRefusedBecause)
    let loseRefusedBecause = $derived(losses.loseRefusedBecause)

    const battleWidth = new ChoiceWidth()
</script>

<!-- R-10.22 — a row of the warbands per place, the board first; the picked warbands die, so they
     are ringed rose. No group gives more than the count owed leaves it. From revision 5 a force
     has one owner, so a row names only where; two owners keep the owner's word. -->
{#snippet countRows(
    groups: readonly WarbandGroup[],
    picked: readonly number[],
    ceilingAt: (index: number) => number,
    onpick: (index: number, n: number) => void
)}
    <WarbandGroupRows
        {groups}
        order={boardFirst(groups)}
        counts={picked}
        {ceilingAt}
        {onpick}
        tone="rose"
    />
{/snippet}

<div>
    <StepHeading {heading} step={spoils.stepNumber} steps={spoilsSteps} />

    {#if gameState.machineState === MachineState.CampaignDefeat}
        {#if !iChooseLosses}
            <WaitingOn />
        {:else}
            <p class="text-sm mb-2">Pick {defeat.required} to kill.</p>
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                {@render countRows(
                    defeat.groups,
                    defeat.picked,
                    (index) => defeat.ceilingAt(index),
                    (index, n) => defeat.setPicked(index, n)
                )}
                <div class="text-oath-text-muted">
                    Chosen {defeat.pickedTotal} of {defeat.required}
                </div>
            </div>
            <!-- Kill waits for the count; a refusal of a complete pick takes its place. -->
            {#if defeat.refusedBecause}
                <p class="mb-2 text-[11px] text-oath-danger">
                    <TokenText text={gameSession.humanizeReason(defeat.refusedBecause) ?? ''} />
                </p>
            {:else if defeat.complete}
                <button
                    class="rounded bg-oath-danger-soft border border-oath-danger/60 text-oath-text hover:border-oath-danger disabled:opacity-40
                           px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    disabled={busy}
                    onclick={() => defeat.choose()}
                >
                    Kill
                </button>
            {/if}
        {/if}
    {:else if !isAttacker}
        <WaitingOn />
    {:else if gameState.machineState === MachineState.CampaignSkullLosses}
        <p class="text-sm mb-2">Skulls: pick {skullLosses.required} to kill.</p>
        <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
            <div
                class="mb-1 grid w-max max-w-full grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1"
            >
                {#each skullLosses.groups as group, index (JSON.stringify(group.at) + group.owner)}
                    {@const where = ownForcePlaceName(
                        gameState,
                        group,
                        skullLosses.groups,
                        (owner) => gameSession.warbandOwnerName(owner)
                    )}
                    <span>{where}</span>
                    <TokenRow
                        image={warbandFigure(gameSession.warbandColor(group.owner))}
                        held={group.count}
                        addable={group.count}
                        picked={skullLosses.picked[index] ?? 0}
                        label={(n) => `kill ${n} ${where}`}
                        ontap={(n) => skullLosses.tap(index, n)}
                        {busy}
                        tone="rose"
                    />
                {/each}
            </div>
            <div class="text-oath-text-muted">
                Chosen {skullLosses.pickedTotal} of {skullLosses.required}
            </div>
        </div>
        <!-- Kill waits for the count; a refusal of a complete pick takes its place. -->
        {#if skullLosses.refusedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(skullLosses.refusedBecause) ?? ''} />
            </p>
        {:else if skullLosses.complete}
            <button
                class="rounded bg-oath-danger-soft border border-oath-danger/60 text-oath-text hover:border-oath-danger disabled:opacity-40
                       px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                disabled={busy}
                onclick={() => skullLosses.kill()}
            >
                Kill
            </button>
        {/if}
    {:else if gameState.machineState === MachineState.CampaignSacrifice}
        <!-- With nothing to sacrifice, the outcome is all there is to say. -->
        {#if needed === 0}
            <p class="text-sm mb-2">{losses.wonWithoutSacrifice ? 'You win.' : 'You lose.'}</p>
        {/if}
        {#if losses.choosesSacrifice}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">To win, sacrifice {needed}:</div>
                {@render countRows(
                    losses.force,
                    losses.sacrificed,
                    (index) => losses.ceilingAt('sacrificed', index),
                    (index, n) => losses.setSacrificed(index, n)
                )}
            </div>
        {/if}
        {#if losses.choosesDefeat}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">If you lose, {losses.defeatRequired} die:</div>
                {@render countRows(
                    losses.force,
                    losses.defeated,
                    (index) => losses.ceilingAt('defeated', index),
                    (index, n) => losses.setDefeated(index, n)
                )}
            </div>
        {/if}

        <!-- Each choice waits for its own picks; a refusal of a complete one takes its place. -->
        {#if winRefusedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                Can't win: {gameSession.humanizeReason(winRefusedBecause)}
            </p>
        {/if}
        {#if loseRefusedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                {gameSession.humanizeReason(loseRefusedBecause)}
            </p>
        {/if}
        <!-- One width for the two, the wider one's; one per line when the two do not fit. -->
        <div class="flex flex-wrap gap-2">
            {#if needed > 0 && losses.winComplete && !winRefusedBecause}
                <button
                    class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    style:min-width="{battleWidth.widest}px"
                    disabled={busy}
                    onclick={() => losses.win()}
                >
                    <span class="inline-block w-max" {@attach battleWidth.measure}
                        >Sacrifice {needed} and win</span
                    >
                </button>
            {/if}
            {#if losses.loseComplete && !loseRefusedBecause}
                <button
                    class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                           px-3 py-1.5 text-sm max-sm:min-h-11"
                    style:min-width="{battleWidth.widest}px"
                    disabled={busy}
                    onclick={() => losses.lose()}
                >
                    <span class="inline-block w-max" {@attach battleWidth.measure}
                        >{needed > 0 ? 'Sacrifice nothing' : 'Continue'}</span
                    >
                </button>
            {/if}
        </div>
    {:else if gameState.machineState === MachineState.CampaignVictory}
        <SpoilsSteps />
    {/if}
</div>
