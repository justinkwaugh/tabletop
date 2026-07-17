<script lang="ts">
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { isEndRoundEvent } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionSegments } from '$lib/utils/actionDescriptions.js'
    import SproutIcon from './SproutIcon.svelte'
    import PlayerNameChip from './PlayerNameChip.svelte'

    let { boardCenterX = null }: { boardCenterX?: number | null } = $props()

    const session = getGameSession()

    // Same filtering as History.svelte, so this always mirrors that list's top entry.
    const lastAction = $derived.by(() => {
        const filtered = session.actions
            .filter((a: GameAction) => a.source !== ActionSource.System || isEndRoundEvent(a))
            .filter((a: GameAction) => !!a.playerId || isEndRoundEvent(a))
        return filtered.at(-1)
    })

    // Segments (not the flattened, dash-joined form History.svelte uses) — Justin wants
    // multi-part entries (e.g. end of round) stacked as separate lines here instead of run
    // together with dashes.
    const descriptionSegments = $derived(
        lastAction ? getDescriptionSegments(lastAction, { allActions: session.actions }) : []
    )
</script>

<!-- Only shown when it's not your turn, or while navigating history — when it IS your turn
     (and you're looking at the live state), the action bar below already tells you what to
     do, so this would just be repeating the previous entry from History for no reason. -->
{#if !session.isMyTurn || session.isViewingHistory}
    <div class="shrink-0 min-h-[44px] mt-2">
        <div class="max-w-[90%] px-3 flex items-center gap-2"
             style="margin-left: {boardCenterX !== null ? `${boardCenterX}px` : '50%'}; transform: translateX(-50%); width: fit-content">
            <SproutIcon class="w-5 h-5 shrink-0" />
            {#key lastAction?.id}
                <div class="flex flex-col items-center"
                     in:fade={{ duration: 200, easing: quartIn }}>
                    {#if lastAction}
                        {#each descriptionSegments as segment, i}
                            <p class="text-[16px] text-amber-200 truncate">
                                {#if i === 0 && lastAction.playerId}
                                    <PlayerNameChip playerId={lastAction.playerId} />
                                {/if}
                                {#each segment as part}
                                    {#if typeof part === 'string'}
                                        {part}
                                    {:else}
                                        <PlayerNameChip playerId={part.playerId} />
                                    {/if}
                                {/each}
                            </p>
                        {/each}
                    {:else}
                        <p class="text-[16px] text-amber-200 truncate">
                            <span class="text-amber-400">Welcome to Santiago!</span>
                        </p>
                    {/if}
                </div>
            {/key}
            <SproutIcon class="w-5 h-5 shrink-0 -scale-x-100" />
        </div>
    </div>
{/if}
