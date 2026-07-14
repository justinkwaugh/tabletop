<script lang="ts">
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { isEndRoundEvent } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
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

    const descriptionParts = $derived(
        lastAction ? getDescriptionForAction(lastAction, { allActions: session.actions }) : []
    )
</script>

<div class="relative shrink-0 h-[44px] mt-2 overflow-hidden">
    <div class="absolute top-0 max-w-[90%] px-3 flex items-center gap-2"
         style="left: {boardCenterX ?? '50%'}px; transform: translateX(-50%)">
        <SproutIcon class="w-5 h-5 shrink-0" />
        {#key lastAction?.id}
            <p class="text-[16px] text-amber-200 truncate"
               in:fade={{ duration: 200, easing: quartIn }} out:fade={{ duration: 80 }}>
                {#if lastAction}
                    {#if lastAction.playerId}
                        <PlayerNameChip playerId={lastAction.playerId} />
                    {/if}
                    {#each descriptionParts as part}
                        {#if typeof part === 'string'}
                            {part}
                        {:else}
                            <PlayerNameChip playerId={part.playerId} />
                        {/if}
                    {/each}
                {:else}
                    <span class="text-amber-400">Welcome to Santiago!</span>
                {/if}
            </p>
        {/key}
        <SproutIcon class="w-5 h-5 shrink-0 -scale-x-100" />
    </div>
</div>
