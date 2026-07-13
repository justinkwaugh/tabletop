<script lang="ts">
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { isEndRoundEvent } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import SproutIcon from './SproutIcon.svelte'

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

<div class="shrink-0 px-3 h-[44px] mt-2 flex items-center justify-center gap-2 overflow-hidden">
    <SproutIcon class="w-5 h-5 shrink-0" />
    {#key lastAction?.id}
        <p class="text-[16px] text-amber-200 truncate"
           in:fade={{ duration: 200, easing: quartIn }} out:fade={{ duration: 80 }}>
            {#if lastAction}
                {#if lastAction.playerId}
                    <PlayerName playerId={lastAction.playerId} />
                {/if}
                {#each descriptionParts as part}
                    {#if typeof part === 'string'}
                        {part}
                    {:else}
                        <PlayerName playerId={part.playerId} />
                    {/if}
                {/each}
            {:else}
                <span class="text-amber-400">Welcome to Santiago!</span>
            {/if}
        </p>
    {/key}
    <SproutIcon class="w-5 h-5 shrink-0 -scale-x-100" />
</div>
