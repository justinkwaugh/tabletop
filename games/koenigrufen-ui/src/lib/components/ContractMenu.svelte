<script lang="ts">
    import type { Contract } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ContractChoices from './ContractChoices.svelte'

    // A button that opens the contracts in a menu below the action area. The menu stops above the
    // player's hand, so the hand stays in view while choosing.
    let {
        label,
        title,
        contracts,
        onchoose,
        openAtOnce = false
    }: {
        label: string
        title: string
        contracts: readonly Contract[]
        onchoose: (contract: Contract) => void
        openAtOnce?: boolean
    } = $props()

    const gameSession = getGameSession()
    const id = $props.id()
    // The menu is never shorter than this, even if it then covers the top of the hand.
    const MinHeight = 160
    const Gap = 6

    let trigger: HTMLButtonElement | undefined = $state()
    let menu: HTMLElement | undefined = $state()
    let open = $state(false)

    // Places the menu under the trigger's row, across the action area.
    function place() {
        if (!trigger || !menu) {
            return
        }
        const button = trigger.getBoundingClientRect()
        const area = (trigger.closest('.action-area') ?? trigger).getBoundingClientRect()
        const top = button.bottom + Gap
        const hand = gameSession.cardPlaces.myHandElement()?.getBoundingClientRect()
        const bottom = hand && hand.top > top + MinHeight ? hand.top - Gap : innerHeight - Gap
        const width = Math.min(area.width - 2 * Gap, 620)
        Object.assign(menu.style, {
            top: `${top}px`,
            left: `${area.left + Gap}px`,
            width: `${width}px`,
            maxHeight: `${Math.max(bottom - top, MinHeight)}px`
        })
    }

    // The contracts are drawn only while open, so each opening starts without a preview.
    function onBeforeToggle(event: ToggleEvent) {
        open = event.newState === 'open'
        if (open) {
            place()
        }
    }

    function choose(contract: Contract) {
        menu?.hidePopover()
        onchoose(contract)
    }

    function openOnMount(element: HTMLElement) {
        if (openAtOnce) {
            element.showPopover()
        }
    }

    // Keeps the menu under its button when the page or a panel around the game scrolls.
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
    class="choice"
    class:open
    popovertarget={id}
    aria-haspopup="dialog"
    aria-expanded={open}>{label} <span class="caret" aria-hidden="true">▾</span></button
>

<div
    bind:this={menu}
    {id}
    class="menu"
    popover="auto"
    role="dialog"
    aria-label={title}
    onbeforetoggle={onBeforeToggle}
    {@attach openOnMount}
    {@attach followScrolling}
>
    <div class="top">
        <span class="title">{title}</span>
        <button type="button" class="close" aria-label="Close" onclick={() => menu?.hidePopover()}
            >✕</button
        >
    </div>
    {#if open}
        <ContractChoices {contracts} onchoose={choose} />
    {/if}
</div>

<style>
    .caret {
        font-size: 0.75em;
        opacity: 0.8;
    }

    .open {
        background: rgb(242 201 76 / 0.2);
    }

    .menu {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 8px 10px 4px;
        overflow-y: auto;
        border: 1px solid rgb(242 201 76 / 0.45);
        border-radius: 10px;
        background: rgb(16 30 21 / 0.97);
        color: #f1e7cf;
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
        font-size: 0.95rem;
    }

    .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
    }

    .title {
        color: #f2c94c;
        font-weight: 600;
    }

    .close {
        padding: 0 6px;
        font-size: 1rem;
        opacity: 0.8;
    }

    @media (max-width: 640px) {
        .menu {
            padding: 6px 8px 2px;
            font-size: 0.85rem;
        }

        .top {
            margin-bottom: 4px;
        }
    }
</style>
