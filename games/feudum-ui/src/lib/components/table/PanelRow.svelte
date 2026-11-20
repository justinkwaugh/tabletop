<script lang="ts" module>
    import type { FeudumGameSession as Session } from '$lib/model/session.svelte.js'

    export type RowPointer = Pick<
        Session,
        'pointAtRow' | 'leaveRow' | 'toggleRowPreview' | 'isRowPointedAt'
    >
</script>

<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import type { BoardTarget } from '$lib/model/boardOffer.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import { crossesEdge } from '$lib/utils/pointerEdge.js'

    /**
     * Contract, Hover: a touch screen, having no hover, gets a "Show on board" preview path.
     * R-3.4 A special's printed cost follows its name. R-3.2 Forfeit is quiet, last in its tray.
     */
    let {
        choice,
        onPress,
        pointer,
        lead,
        face,
        corner,
        piece,
        quiet = false
    }: {
        choice: PanelChoice
        onPress: (choice: PanelChoice) => void
        pointer: RowPointer
        lead?: Snippet
        face?: Snippet
        corner?: Snippet
        piece?: Snippet
        quiet?: boolean
    } = $props()

    const owner = {}

    let refusalShown = $state(false)
    let refused = $derived(choice.refusal !== undefined)
    let dimmed = $derived(refused || choice.spent === true)
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

    function pointOver(event: PointerEvent) {
        if (crossesEdge(event)) {
            point(event)
        }
    }

    function leaveOut(event: PointerEvent) {
        if (crossesEdge(event)) {
            leave()
        }
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
    class="relative inline-flex items-stretch gap-1 {face || piece ? 'min-w-0 flex-col' : ''}"
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
                    {dimmed ? 'opacity-50' : ''}"
                aria-label={choice.label}
                aria-pressed={choice.picked}
                aria-disabled={dimmed}
                onpointerover={pointOver}
                onpointerout={leaveOut}
                onfocus={point}
                onblur={leave}
                onclick={press}
            >
                {@render face()}
            </button>
            {#if corner}{@render corner()}{/if}
        </span>
    {:else if piece}
        <button
            type="button"
            class="piece-press inline-flex justify-center rounded-lg p-1 {dimmed
                ? 'opacity-50'
                : ''}"
            aria-label={choice.label}
            title={choice.label}
            aria-pressed={choice.picked}
            aria-disabled={dimmed}
            onpointerover={pointOver}
            onpointerout={leaveOut}
            onfocus={point}
            onblur={leave}
            onclick={press}
        >
            {@render piece()}
        </button>
    {:else}
        <button
            type="button"
            class="inline-flex flex-wrap items-center gap-x-1 rounded-lg px-3 py-1 text-sm border
                {quiet ? 'text-feudum-text-muted' : 'text-feudum-text'}
                {choice.picked
                ? 'bg-feudum-primary border-feudum-accent'
                : quiet
                  ? 'bg-transparent border-feudum-frame'
                  : 'bg-feudum-control border-feudum-frame'}
                {dimmed ? 'opacity-50' : 'hover:bg-feudum-control-hover'}"
            aria-label={choice.shown === undefined ? undefined : choice.label}
            aria-pressed={choice.picked}
            aria-disabled={dimmed}
            data-quiet={quiet ? '' : undefined}
            onpointerover={pointOver}
            onpointerout={leaveOut}
            onfocus={point}
            onblur={leave}
            onclick={press}
        >
            {#if lead}{@render lead()}{/if}
            <span class={lead ? 'beside-art' : ''}>{choice.shown ?? choice.label}</span>
            {#if choice.note}
                <span
                    class={choice.note.kind === 'cost' || choice.note.kind === 'threat'
                        ? 'text-feudum-danger'
                        : 'text-feudum-accent'}
                    data-note={choice.note.kind}>{choice.note.label}</span
                >
            {/if}
            {#if choice.cost}
                <span class="inline-flex items-center gap-0.5 text-xs" data-cost>
                    {#if choice.cost.kind === 'good'}
                        <GoodToken good={choice.cost.good} size={16} />{choice.cost.count}
                        {#if choice.cost.barrel}<span class="beside-art">barrel</span>{/if}
                    {:else}
                        <ShillingToken value={1} size={16} />{choice.cost.count}
                    {/if}
                </span>
            {/if}
        </button>
    {/if}
    {#if choice.lights}
        <button
            type="button"
            class="touch-preview rounded-lg px-2 bg-feudum-control text-xs leading-tight text-feudum-text
                {face ? 'on-face' : ''} {piece ? 'beneath' : ''}"
            aria-label="Show on board: {choice.label}"
            aria-pressed={previewing}
            data-preview={choice.label}
            onclick={() => {
                if (lights) {
                    pointer.toggleRowPreview(owner, lights)
                }
            }}
            ><span class="label-wide">Show on board</span><span class="label-narrow">On board</span
            ></button
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

    .label-narrow {
        display: none;
    }

    .touch-preview.beneath {
        width: 100%;
        min-width: 0;
        padding: 0;
        white-space: nowrap;
    }

    .touch-preview.beneath .label-wide {
        display: none;
    }

    .touch-preview.beneath .label-narrow {
        display: inline;
    }

    @media (hover: none) {
        .touch-preview {
            display: inline-block;
        }
    }

    /* Contract, Phone layout: a phone's card has no preview path; its press is undoable. */
    @media (max-width: 40rem), (max-height: 520px) and (orientation: landscape) {
        .touch-preview.on-face {
            display: none;
        }

        .piece-press {
            padding: 0;
        }

        .touch-preview.beneath {
            font-size: 0.625rem;
        }
    }
</style>
