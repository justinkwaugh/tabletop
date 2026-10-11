<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists, range } from '@tabletop/common'
    import { MachineState, type WarbandGroup } from '@tabletop/oath'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import SpoilsSteps from '$lib/components/SpoilsSteps.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { siteName } from '$lib/model/names.js'
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

    /** For a count's screen-reader name; the row shows the board's owner as their chip. */
    function whereText(group: WarbandGroup): string {
        return group.at.kind === 'board'
            ? `on ${gameSession.getPlayerName(group.at.playerId)}'s board`
            : `at ${siteName(gameState, group.at.siteId)}`
    }

    let winRefusedBecause = $derived(losses.winRefusedBecause)
    let loseRefusedBecause = $derived(losses.loseRefusedBecause)

    const battleWidth = new ChoiceWidth()
</script>

{#snippet groupName(group: WarbandGroup)}
    {gameSession.warbandOwnerName(group.owner)}
    {#if group.at.kind === 'board'}on <PlayerName playerId={group.at.playerId} possessive /> board{:else}at
        {siteName(gameState, group.at.siteId)}{/if}
{/snippet}

{#snippet countRows(
    groups: readonly WarbandGroup[],
    picked: readonly number[],
    onpick: (index: number, n: number) => void
)}
    {#each groups as group, index (JSON.stringify(group.at) + group.owner)}
        <div class="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span class="w-56 max-sm:w-full">{@render groupName(group)}</span>
            <CountPicker
                values={range(0, group.count + 1)}
                picked={picked[index] ?? 0}
                label={(n) =>
                    `${n} of the ${gameSession.warbandOwnerName(group.owner)} warbands ${whereText(group)}`}
                onpick={(n) => onpick(index, n)}
                disabled={busy}
            />
        </div>
    {/each}
{/snippet}

<div>
    <div class="mb-2 flex items-center gap-2.5">
        <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger">{heading}</h3>
        {#if spoilsSteps > 1}
            <span class="flex items-center gap-1" aria-hidden="true">
                {#each range(1, spoilsSteps) as n (n)}
                    <span
                        class="rounded-full {n === spoils.stepNumber
                            ? 'h-2.5 w-2.5 bg-oath-accent ring-2 ring-oath-accent-soft'
                            : n < spoils.stepNumber
                              ? 'h-1.5 w-1.5 bg-oath-accent'
                              : 'h-1.5 w-1.5 bg-oath-text-muted/50'}"
                    ></span>
                {/each}
            </span>
            <span class="text-xs text-oath-text-muted">{spoils.stepNumber} of {spoilsSteps}</span>
        {/if}
    </div>

    {#if gameState.machineState === MachineState.CampaignDefeat}
        {#if !iChooseLosses}
            <WaitingOn />
        {:else}
            <p class="text-sm mb-2">Pick {defeat.required} to kill.</p>
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                {@render countRows(defeat.groups, defeat.picked, (index, n) =>
                    defeat.setPicked(index, n)
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
    {:else if gameState.machineState === MachineState.CampaignSacrifice}
        <!-- With nothing to sacrifice, the outcome is all there is to say. -->
        {#if needed === 0}
            <p class="text-sm mb-2">{losses.wonWithoutSacrifice ? 'You win.' : 'You lose.'}</p>
        {/if}
        {#if losses.choosesSacrifice}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">To win, sacrifice {needed}:</div>
                {@render countRows(losses.force, losses.sacrificed, (index, n) =>
                    losses.setSacrificed(index, n)
                )}
            </div>
        {/if}
        {#if losses.choosesDefeat}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">If you lose, {losses.defeatRequired} die:</div>
                {@render countRows(losses.force, losses.defeated, (index, n) =>
                    losses.setDefeated(index, n)
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
