<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists, range } from '@tabletop/common'
    import { CardKind, MachineState, type WarbandGroup } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, siteName, relicSiteName } from '$lib/model/names.js'
    import { spoilsSummary } from '$lib/model/spoils.js'
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
    let defenderId = $derived(campaign.defenderPlayerId)
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
    let spoils = $derived(gameSession.victory)

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

    let spoilsList = $derived(
        spoilsSummary(gameState, campaign.targets, spoils.placeCounts, defenderId)
    )

    const battleWidth = new ChoiceWidth()
    const spoilsWidth = new ChoiceWidth()
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
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-2">{heading}</h3>

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
        <ul class="mb-2 list-disc pl-5 text-sm text-oath-text">
            {#each spoilsList as item, index (index)}
                <li>
                    {#if item.kind === 'pawn'}<PlayerName playerId={item.playerId} possessive /> pawn
                        and favor{:else}{item.text}{/if}
                </li>
            {/each}
        </ul>
        {#if spoils.relicTargets.length > 0}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">Tap to put a relic on the bottom of the relic deck.</div>
                <CardChoiceRow
                    choices={spoils.relicTargets.map((slotId) => {
                        const known = gameSession.knownRelicAt(slotId)
                        const at = relicSiteName(gameState, slotId)
                        return known
                            ? { key: slotId, cardId: known, label: `${cardName(known)} at ${at}` }
                            : { key: slotId, back: CardKind.Relic, label: `the relic at ${at}` }
                    })}
                    picked={spoils.bottomSlots}
                    onpick={(slotId) =>
                        spoils.setBottom(slotId, !spoils.bottomSlots.includes(slotId))}
                    {busy}
                    height={80}
                />
            </div>
        {/if}
        {#if spoils.capturedSites.length > 0 && spoils.forceOwners.length > 0}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1">
                    Place warbands: {spoils.placedTotal} of {spoils.forceAvailable}.
                </div>
                {#each spoils.capturedSites as siteId (siteId)}
                    {#each spoils.forceOwners as owner (owner)}
                        {@const count = spoils.countAt(siteId, owner)}
                        {@const ceiling = spoils.ceilingAt(siteId, owner)}
                        <div class="mb-1 flex items-center gap-2">
                            <span class="grow"
                                >{siteName(gameState, siteId)}{spoils.forceOwners.length > 1
                                    ? ` — ${gameSession.warbandOwnerName(owner)}`
                                    : ''}</span
                            >
                            <button
                                type="button"
                                class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-0.5"
                                disabled={busy || count <= 0}
                                onclick={() => spoils.setPlaceCount(siteId, owner, count - 1)}
                            >
                                −
                            </button>
                            <span class="w-6 text-center font-semibold">{count}</span>
                            <button
                                type="button"
                                class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-0.5"
                                disabled={busy || count >= ceiling}
                                onclick={() => spoils.setPlaceCount(siteId, owner, count + 1)}
                            >
                                +
                            </button>
                        </div>
                    {/each}
                {/each}
            </div>
        {/if}

        {#if spoils.woodChooses && defenderId !== undefined}
            <label class="mb-2 flex items-center gap-2 text-xs">
                <input
                    type="checkbox"
                    checked={spoils.banishByWood}
                    disabled={busy}
                    onchange={(e) => spoils.setBanishByWood(e.currentTarget.checked)}
                />
                <span
                    >Banish <PlayerName playerId={defenderId} />; the Wood's ruler picks where</span
                >
            </label>
        {/if}
        {#if spoils.banishSites.length > 0 && defenderId !== undefined}
            <label class="mb-2 flex items-center gap-2 text-xs">
                <span class="text-oath-text-muted"
                    >Banish <PlayerName playerId={defenderId} /> to:</span
                >
                <select
                    disabled={busy}
                    class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs grow"
                    value={spoils.banishSite ?? ''}
                    onchange={(e) => spoils.setBanishSite(e.currentTarget.value || undefined)}
                >
                    <option value="">nowhere</option>
                    {#each spoils.banishSites as siteId (siteId)}
                        <option value={siteId}>{siteName(gameState, siteId)}</option>
                    {/each}
                </select>
            </label>
        {/if}
        <!-- The reason the spoils are refused takes the buttons' place. -->
        {#if spoils.blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(spoils.blockedBecause) ?? ''} />
            </p>
        {:else}
            <!-- One width for the two, the wider one's; one per line when the two do not fit. -->
            <div class="flex flex-wrap gap-2">
                <button
                    class="shrink-0 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                    style:min-width="{spoilsWidth.widest}px"
                    disabled={busy}
                    onclick={() => spoils.takeSpoils(false)}
                >
                    <span class="inline-block w-max" {@attach spoilsWidth.measure}>Take spoils</span
                    >
                </button>
                {#if spoils.mayBurnFavor}
                    <!-- R-5.5.7.III — "may burn half their favor" is a choice, so a second button. -->
                    <button
                        class="burn shrink-0 rounded bg-oath-danger-soft border border-oath-danger/60 text-oath-text hover:border-oath-danger disabled:opacity-40
                               px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                        style:min-width="{spoilsWidth.widest}px"
                        disabled={busy}
                        title="Take the spoils and burn half the defeated player's favor, {spoils.burnAmount} of it"
                        onclick={() => spoils.takeSpoils(true)}
                    >
                        <span class="inline-block w-max" {@attach spoilsWidth.measure}
                            ><TokenText text={`Take and burn ${spoils.burnAmount} favor`} /></span
                        >
                    </button>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    /* The burnt favor: the token as the text draws it, scorched. */
    .burn :global(img) {
        filter: sepia(1) saturate(4) hue-rotate(-30deg) brightness(0.7) contrast(1.3);
    }
</style>
