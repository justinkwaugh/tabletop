<script lang="ts">
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { swapRuleFromConfig } from '@tabletop/hex'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const swapRule = $derived(swapRuleFromConfig(session.game.config))

    // The panel is held to the screen below the header, so it never runs off a short phone.
    let open = $state(false)
    let panel: HTMLDivElement | undefined = $state()
    $effect(() => {
        if (!open || !panel) return
        const node = panel
        const fit = () => {
            // Measured from the header it opens under: the panel itself is placed a frame later.
            const below = document.querySelector(reference)?.getBoundingClientRect().bottom ?? 0
            // The visible area: a page wider than the phone stretches innerHeight past it.
            const view = window.visualViewport
            const bottom = view ? view.offsetTop + view.height : window.innerHeight
            const room = bottom - below - OFFSET - 8
            node.style.maxHeight = `${Math.max(160, Math.min(640, room))}px`
        }
        const frame = requestAnimationFrame(fit)
        const view = window.visualViewport ?? window
        view.addEventListener('resize', fit)
        return () => {
            cancelAnimationFrame(frame)
            view.removeEventListener('resize', fit)
        }
    })
</script>

<button type="button" id={chipId} class="chip" aria-label="Rules reference">?</button>
<Popover
    {reference}
    triggeredBy={`#${chipId}`}
    trigger="click"
    placement="bottom-end"
    offset={OFFSET}
    arrow={false}
    class="z-50 border-0 bg-transparent shadow-none dark:border-0 dark:bg-transparent"
    classes={{ content: 'p-0' }}
    bind:isOpen={open}
>
    <div class="legend" bind:this={panel}>
        <section>
            <h3>Goal</h3>
            <p>
                Join your two edges with one unbroken chain of your stones: Red the top and bottom,
                Blue the left and right. Corner cells belong to both edges. Hex has no draws.
            </p>
        </section>
        <section>
            <h3>Your turn</h3>
            <p>Place one stone on any empty cell. Stones never move. Red places first.</p>
        </section>
        {#if swapRule}
            <section>
                <h3>Swap rule</h3>
                <p>
                    On Blue’s first turn, Blue may swap instead of placing. The stone stays red, the
                    swapping player becomes Red, and the other player, now Blue, places next.
                </p>
            </section>
        {/if}
    </div>
</Popover>

<style>
    /* Drawn in the header's own ink, like the turn and Undo beside it. */
    .chip {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 9999px;
        box-shadow: inset 0 0 0 1.5px currentColor;
        color: inherit;
        font-size: 15px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0;
    }

    @media (hover: hover) {
        .chip:hover {
            background: color-mix(in srgb, currentColor 12%, transparent);
        }
    }

    .legend {
        width: min(480px, calc(100vw - 16px));
        max-height: min(70dvh, 640px);
        overflow-y: auto;
        padding: 12px 14px;
        border: 1px solid var(--hex-panel-edge);
        border-radius: 0.5rem;
        background: var(--hex-panel);
        box-shadow: var(--hex-panel-shadow);
        color: var(--hex-ink);
        font-size: 14px;
        line-height: 1.35;
        letter-spacing: normal;
        text-align: left;
    }

    @media (max-width: 359px) {
        .legend {
            padding: 10px 12px;
            font-size: 13px;
        }
    }

    section + section {
        margin-top: 10px;
    }

    h3 {
        margin-bottom: 4px;
        color: var(--hex-ink-quiet);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
</style>
