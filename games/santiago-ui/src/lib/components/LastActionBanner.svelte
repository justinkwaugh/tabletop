<script lang="ts">
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { isEndRoundEvent } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionSegments } from '$lib/utils/actionDescriptions.js'
    import SproutIcon from './SproutIcon.svelte'
    import PlayerNameChip from './PlayerNameChip.svelte'

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

    // On your own turn, looking at the live state, the action bar below already says what to do.
    const repeatsTheBar = $derived(session.isMyTurn && !session.isViewingHistory)
</script>

<!-- While it would repeat the action bar, the row stays, empty, at its one-line height, so the
     board does not jump when the turn passes, and the action bar's own slide is the only
     movement. -->
<div class="shrink-0 min-h-[44px] mt-2" aria-hidden={repeatsTheBar}>
    {#if !repeatsTheBar}
        <div class="centered-line max-w-[90%] px-3 flex items-center gap-2">
            <SproutIcon class="w-5 h-5 shrink-0" />
            {#key lastAction?.id}
                <div
                    class="flex flex-col items-center"
                    in:fade={{ duration: 200, easing: quartIn }}
                >
                    {#if lastAction}
                        {#each descriptionSegments as segment, i (i)}
                            <p class="text-[16px] text-amber-200 truncate">
                                {#if i === 0 && lastAction.playerId}
                                    <PlayerNameChip playerId={lastAction.playerId} />
                                {/if}
                                {#each segment as part, j (j)}
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
    {/if}
</div>

<style>
    /* The board center is measured in screen pixels; dividing by the zoom applied to everything
       above the board on phones keeps it in this element's own pixels. */
    .centered-line {
        margin-left: calc(var(--board-center, 50%) / var(--above-board-zoom, 1));
        transform: translateX(-50%);
        width: fit-content;
    }
</style>
