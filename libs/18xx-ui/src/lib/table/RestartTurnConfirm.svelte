<script lang="ts">
    import { popoverBelowEnd } from '../presentation/popoverPlacement.js'
    import type { TurnRestart } from '../session/turnRestart.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    // Rendered outside the turn header, so the header's turn-attention colours stay off the panel.
    let {
        session,
        restart,
        id,
        anchor,
        open = $bindable(false)
    }: {
        session: EighteenXXSessionView
        restart: TurnRestart
        id: string
        anchor: HTMLElement | undefined
        open?: boolean
    } = $props()
    const width = 260
    let panel: HTMLDivElement | undefined = $state()
    let bounds = $state({ right: 0, top: 0 })
    const own = $derived(restart.target.playerId === session.myPlayer?.id)
    const actor = $derived(own ? 'your' : `${session.getPlayerName(restart.target.playerId)}'s`)
    const question = $derived(
        `Restart ${restart.companyId ? `${session.companyName(restart.companyId)}'s` : actor} turn?`
    )
    const undone = $derived(
        restart.undoneCount === 1
            ? `${actor} last action`
            : `${actor} last ${restart.undoneCount} actions`
    )
    function prepare(event: ToggleEvent) {
        open = event.newState === 'open'
        if (open && anchor) bounds = popoverBelowEnd(anchor, width)
    }
    function confirm() {
        panel?.hidePopover()
        void session.restartTurn()
    }
</script>

<div
    {id}
    bind:this={panel}
    class="confirm"
    role="dialog"
    aria-label="Restart turn"
    popover="auto"
    onbeforetoggle={prepare}
    style:right={`${bounds.right}px`}
    style:top={`${bounds.top}px`}
    style:width={`min(${width}px, calc(100vw - 16px))`}
>
    <p><strong>{question}</strong> Undoes {undone}.</p>
    <div class="choices">
        <button popovertarget={id} popovertargetaction="hide">Cancel</button>
        <button class="go" disabled={session.busy || session.updatingVisibleState} onclick={confirm}
            >Restart turn</button
        >
    </div>
</div>

<style>
    .confirm {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 8px;
        background: var(--rail-surface-raised, #fffaf3);
        color: var(--rail-text, #5e4937);
        box-shadow: 0 6px 18px var(--rail-shadow, #00000033);
        font-size: 12.5px;
        line-height: 1.4;
    }
    p {
        margin: 0;
    }
    strong {
        display: block;
        font-weight: 650;
    }
    .choices {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 8px;
    }
    button {
        padding: 5px 9px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
    button:hover:enabled {
        background: var(--rail-hover, #ffffff66);
    }
    button:disabled {
        opacity: 0.3;
        cursor: default;
    }
    .go,
    .go:hover:enabled {
        background: var(--rail-solid, #695543);
        color: #fffaf3;
    }
</style>
