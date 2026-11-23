<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { BidChoice } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bidHeading, contractTerms } from '$lib/utils/contractText.js'

    // The contract named in the header, drawn as the plain text it was. Pointing at it shows its
    // terms below it; a click or tap keeps them open until a click outside or Escape.
    let { choice, children }: { choice: BidChoice; children: Snippet } = $props()

    const gameSession = getGameSession()
    const id = $props.id()
    const terms = $derived(contractTerms(choice, gameSession.tableRules))
    const Gap = 6
    const Gutter = 8
    const MaxWidth = 340

    let trigger: HTMLButtonElement | undefined = $state()
    let popup: HTMLElement | undefined = $state()
    let open = $state(false)
    // Opened by pointing, so it closes when the pointer leaves, unless a click keeps it.
    let fromHover = false

    // Centres the terms under the contract, kept inside the window.
    function place() {
        if (!trigger || !popup) {
            return
        }
        const button = trigger.getBoundingClientRect()
        const width = Math.min(MaxWidth, innerWidth - 2 * Gutter)
        const centred = button.left + button.width / 2 - width / 2
        const left = Math.min(Math.max(centred, Gutter), innerWidth - Gutter - width)
        Object.assign(popup.style, {
            top: `${button.bottom + Gap}px`,
            left: `${left}px`,
            width: `${width}px`
        })
    }

    function onBeforeToggle(event: ToggleEvent) {
        open = event.newState === 'open'
        if (open) {
            place()
        } else {
            fromHover = false
        }
    }

    // Pointing never opens the terms over another open menu, such as the announcements, which
    // showing them would close.
    function onPointerEnter(event: PointerEvent) {
        if (event.pointerType === 'mouse' && !open && !document.querySelector(':popover-open')) {
            fromHover = true
            popup?.showPopover()
        }
    }

    function onPointerLeave(event: PointerEvent) {
        if (event.pointerType === 'mouse' && fromHover) {
            popup?.hidePopover()
        }
    }

    // A click on terms opened by pointing keeps them open instead of closing them.
    function onClick(event: MouseEvent) {
        if (fromHover) {
            event.preventDefault()
            fromHover = false
        }
    }

    // Keeps the terms under the contract when the page or a panel around the game scrolls.
    function followScrolling() {
        const follow = () => open && place()
        addEventListener('scroll', follow, { capture: true, passive: true })
        return () => removeEventListener('scroll', follow, { capture: true })
    }
</script>

<svelte:window onresize={() => open && place()} />

<button
    bind:this={trigger}
    type="button"
    class="contract"
    popovertarget={id}
    aria-expanded={open}
    aria-controls={id}
    onpointerenter={onPointerEnter}
    onpointerleave={onPointerLeave}
    onclick={onClick}>{@render children()}</button
>

<div
    bind:this={popup}
    {id}
    class="terms"
    popover="auto"
    aria-label="Contract terms"
    onbeforetoggle={onBeforeToggle}
    {@attach followScrolling}
>
    <div class="title">{bidHeading(choice)}</div>
    <p>{terms.traits}</p>
    {#each terms.notes as note (note)}
        <p>{note}</p>
    {/each}
</div>

<style>
    .contract {
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: inherit;
        cursor: help;
    }

    .contract:focus-visible {
        outline: 1px solid rgb(242 201 76 / 0.7);
        outline-offset: 3px;
        border-radius: 3px;
    }

    .terms {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 8px 12px;
        border: 1px solid rgb(241 231 207 / 0.25);
        border-radius: 8px;
        background: rgb(16 30 21 / 0.97);
        color: #f1e7cf;
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.4);
        font-size: 0.85rem;
        font-weight: 400;
        line-height: 1.35;
    }

    .title {
        margin-bottom: 4px;
        color: #f2c94c;
        font-weight: 600;
    }

    .terms p {
        margin: 0 0 4px;
    }

    @media (max-width: 640px) {
        .terms {
            padding: 6px 10px;
            font-size: 0.8rem;
        }
    }
</style>
