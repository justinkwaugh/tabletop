<script lang="ts">
    import { onDestroy } from 'svelte'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * One row of a panel or popup. A row's hover or focus brightens what its press would light, and a
     * touch screen, having no hover, has a small preview path beside the row (contract: Hover). A
     * refused row stays pressable, to show the line why, and sends nothing.
     */
    let { choice, onPress }: { choice: PanelChoice; onPress: (choice: PanelChoice) => void } =
        $props()

    const gameSession = getGameSession()
    const owner = {}

    let refusalShown = $state(false)
    let refused = $derived(choice.refusal !== undefined)
    let previewing = $derived(gameSession.isRowPointedAt(owner))

    function point(event: PointerEvent | FocusEvent) {
        const touch = 'pointerType' in event && event.pointerType === 'touch'
        if (choice.lights && !touch) {
            gameSession.pointAtRow(owner, choice.lights)
        }
    }

    function leave() {
        gameSession.leaveRow(owner)
    }

    function press() {
        leave()
        if (refused) {
            refusalShown = true
        } else {
            onPress(choice)
        }
    }

    onDestroy(leave)
</script>

<span class="inline-flex items-stretch gap-1" data-row={choice.label}>
    <button
        type="button"
        class="rounded-lg px-3 py-1 text-sm border border-feudum-frame text-feudum-text
            {choice.picked ? 'bg-feudum-primary border-feudum-accent' : 'bg-feudum-control'}
            {refused ? 'opacity-50' : 'hover:bg-feudum-control-hover'}"
        aria-pressed={choice.picked}
        aria-disabled={refused}
        onpointerenter={point}
        onpointerleave={leave}
        onfocus={point}
        onblur={leave}
        onclick={press}
    >
        {choice.label}
        {#if choice.note}
            <span class={choice.note.kind === 'cost' ? 'text-feudum-danger' : 'text-feudum-accent'}
                >{choice.note.label}</span
            >
        {/if}
    </button>
    {#if choice.lights}
        <button
            type="button"
            class="touch-preview rounded-lg px-2 bg-feudum-control text-feudum-text"
            aria-label="Preview {choice.label} on the board"
            aria-pressed={previewing}
            data-preview={choice.label}
            onclick={() => {
                if (choice.lights) {
                    gameSession.toggleRowPreview(owner, choice.lights)
                }
            }}>?</button
        >
    {/if}
    {#if refusalShown && choice.refusal}
        <span class="self-center text-xs text-feudum-danger" data-refusal>{choice.refusal}</span>
    {/if}
</span>

<style>
    .touch-preview {
        display: none;
    }

    @media (hover: none) {
        .touch-preview {
            display: inline-block;
        }
    }
</style>
