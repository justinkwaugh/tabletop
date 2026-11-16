<script lang="ts">
    import { MachineState } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        buildProgress,
        buildableRailroads,
        decidingPlayerId,
        journeyLine,
        latestJourney,
        latestShare,
        placedText,
        stillToTakeShare
    } from '$lib/model/actionArea.js'
    import {
        describeAction,
        type Description as DescriptionSegments
    } from '$lib/utils/describeAction.js'
    import Description from '../Description.svelte'
    import RailroadChip from './RailroadChip.svelte'
    import SeatMoneyChips from './SeatMoneyChips.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const deciderId = $derived(decidingPlayerId(state))
    const deciderName = $derived(deciderId ? gameSession.getPlayerName(deciderId) : '')

    const nextSeats = $derived(
        deciderId && state.machineState === MachineState.TakingShares
            ? stillToTakeShare(state, deciderId).map((id) => gameSession.getPlayerName(id))
            : []
    )
    const progress = $derived(
        state.machineState === MachineState.Building ? buildProgress(state) : undefined
    )
    // Contract, Watching: only the railroads with a legal placement now.
    const mayBuild = $derived(progress && deciderId ? buildableRailroads(state, deciderId) : [])

    // What the previous seat just did in this phase: the share taken, or the journey made.
    const lastLine: DescriptionSegments | undefined = $derived.by(() => {
        if (state.machineState === MachineState.TakingShares) {
            const share = latestShare(gameSession.actions)
            return share && describeAction(share)
        }
        if (state.machineState === MachineState.Riding) {
            const journey = latestJourney(gameSession.actions)
            return (
                journey && (journeyLine(journey, gameSession.myPlayerId) ?? describeAction(journey))
            )
        }
        return undefined
    })
</script>

<div class="flex flex-col gap-1.5">
    {#if deciderId}
        <h2 class="text-base font-bold">
            {#if state.machineState === MachineState.TakingShares}
                {deciderName} is taking a share
            {:else if progress}
                {deciderName} is building · {placedText(progress)}
            {:else}
                {deciderName} is choosing a journey
            {/if}
        </h2>
    {/if}
    {#if nextSeats.length > 0}
        <div class="text-sm text-rtr-ink-muted">then {nextSeats.join(', ')}</div>
    {/if}
    {#if mayBuild.length > 0}
        <div class="flex flex-wrap items-center gap-1.5 text-sm text-rtr-ink-muted max-sm:hidden">
            May build:
            {#each mayBuild as railroadId (railroadId)}
                <RailroadChip {railroadId} />
            {/each}
        </div>
    {/if}
    {#if lastLine}
        <!-- Plain inline flow keeps the spaces between the segments. -->
        <p class="text-sm leading-7 text-rtr-ink-muted">
            <Description description={lastLine} />
        </p>
    {/if}
    <SeatMoneyChips />
</div>
