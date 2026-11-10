<script lang="ts" module>
    import type { FeudumGameSession as Session } from '$lib/model/session.svelte.js'

    /** Who hears a row's hover: the session, in a game. */
    export type RowPointer = Pick<
        Session,
        'pointAtRow' | 'leaveRow' | 'toggleRowPreview' | 'isRowPointedAt'
    >
</script>

<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import type { BoardTarget } from '$lib/model/boardOffer.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'

    /**
     * One row of a panel or popup. A row's hover or focus brightens what its press would light, and a
     * touch screen, having no hover, has a preview path beside the row that reads "Show on board"
     * (contract: Hover). A
     * refused row stays pressable, to show the line why, and sends nothing. `lead` stands before the
     * label; `face` takes the label's place on a card or writ, whose corner holds the magnifier.
     */
    let {
        choice,
        onPress,
        pointer,
        lead,
        face,
        corner
    }: {
        choice: PanelChoice
        onPress: (choice: PanelChoice) => void
        pointer: RowPointer
        lead?: Snippet
        face?: Snippet
        corner?: Snippet
    } = $props()

    const owner = {}

    let refusalShown = $state(false)
    let refused = $derived(choice.refusal !== undefined)
    let previewing = $derived(pointer.isRowPointedAt(owner))
    let lights: (() => readonly BoardTarget[]) | undefined = $derived(choice.lights)

    function point(event: PointerEvent | FocusEvent) {
        const touch = 'pointerType' in event && event.pointerType === 'touch'
        if (lights && !touch) {
            pointer.pointAtRow(owner, lights)
        }
    }

    function leave() {
        pointer.leaveRow(owner)
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

<span
    class="relative inline-flex items-stretch gap-1 {face ? 'min-w-0 flex-col' : ''}"
    data-row={choice.label}
    data-picked={choice.picked ? '' : undefined}
>
    {#if face}
        <span class="relative block h-full">
            <button
                type="button"
                class="face block w-full rounded-md outline-offset-1
                    {choice.picked
                    ? 'outline-2 outline-feudum-accent'
                    : 'hover:outline-1 hover:outline-feudum-frame'}
                    {refused ? 'opacity-50' : ''}"
                aria-label={choice.label}
                aria-pressed={choice.picked}
                aria-disabled={refused}
                onpointerenter={point}
                onpointerleave={leave}
                onfocus={point}
                onblur={leave}
                onclick={press}
            >
                {@render face()}
            </button>
            {#if corner}{@render corner()}{/if}
        </span>
    {:else}
        <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm border text-feudum-text
                {choice.picked
                ? 'bg-feudum-primary border-feudum-accent'
                : 'bg-feudum-control border-feudum-frame'}
                {refused ? 'opacity-50' : 'hover:bg-feudum-control-hover'}"
            aria-pressed={choice.picked}
            aria-disabled={refused}
            onpointerenter={point}
            onpointerleave={leave}
            onfocus={point}
            onblur={leave}
            onclick={press}
        >
            {#if lead}{@render lead()}{/if}
            <span class={lead ? 'beside-art' : ''}>{choice.label}</span>
            {#if choice.note}
                <span
                    class={choice.note.kind === 'cost' || choice.note.kind === 'threat'
                        ? 'text-feudum-danger'
                        : 'text-feudum-accent'}
                    data-note={choice.note.kind}>{choice.note.label}</span
                >
            {/if}
        </button>
    {/if}
    {#if choice.lights}
        <button
            type="button"
            class="touch-preview rounded-lg px-2 bg-feudum-control text-xs leading-tight text-feudum-text
                {face ? 'on-face' : ''}"
            aria-label="Show on board: {choice.label}"
            aria-pressed={previewing}
            data-preview={choice.label}
            onclick={() => {
                if (lights) {
                    pointer.toggleRowPreview(owner, lights)
                }
            }}>Show on board</button
        >
    {/if}
    {#if refusalShown && choice.refusal}
        <span class="self-center text-xs text-feudum-danger" data-refusal>{choice.refusal}</span>
    {/if}
</span>

<style>
    .face :global(svg) {
        display: block;
        width: 100%;
        height: auto;
    }

    .touch-preview {
        display: none;
    }

    .touch-preview.on-face {
        position: absolute;
        top: 2px;
        right: 2px;
    }

    @media (hover: none) {
        .touch-preview {
            display: inline-block;
        }
    }

    /* Contract, Phone layout: no room on a phone's card for a preview too, so it stands beneath. */
    @media (max-width: 40rem), (max-height: 520px) and (orientation: landscape) {
        .touch-preview.on-face {
            position: relative;
            top: auto;
            right: auto;
            width: 100%;
            padding: 0;
        }
    }
</style>
