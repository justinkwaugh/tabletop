<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RINGS_TO_WIN, versionFromConfig } from '@tabletop/yinsh'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const ringsToWin = $derived(RINGS_TO_WIN[versionFromConfig(session.game.config)])

    // Holds the panel to the screen below the header, so it never runs off a short phone. The
    // popover mounts its contents only while open, so this runs each time it opens.
    const fitBelowHeader: Attachment<HTMLElement> = (node) => {
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
    }
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
>
    <div class="legend" {@attach fitBelowHeader}>
        <section>
            <h3>Moving a ring</h3>
            <ul>
                <li>
                    Put a marker of your colour inside one of your rings, then move that ring in a
                    straight line to a vacant space.
                </li>
                <li>
                    It may pass over vacant spaces and jump one unbroken line of markers, stopping
                    on the first vacant space after them. It never passes over a ring.
                </li>
                <li>Every marker it jumps flips over to the other colour.</li>
            </ul>
        </section>
        <section>
            <h3>Rows of five</h3>
            <ul>
                <li>
                    Five of your markers in a line: take them away and remove one of your rings.
                    From a longer run, choose any five in a row.
                </li>
                <li>The mover takes their rows first, then the opponent.</li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>
                {ringsToWin === 1
                    ? 'The first ring you remove wins.'
                    : `The first to remove ${ringsToWin} rings wins.`} If the markers run out, the player
                who has removed more rings wins; equal counts draw.
            </p>
        </section>
        <section>
            <h3>Placing</h3>
            <p>Each player places five rings, in turn, on vacant spaces before any ring moves.</p>
        </section>
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
        border: 1px solid var(--yinsh-panel-edge);
        border-radius: 0.5rem;
        background: var(--yinsh-panel);
        box-shadow: var(--yinsh-panel-shadow);
        color: var(--yinsh-ink);
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
        color: var(--yinsh-ink-quiet);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    ul {
        padding-left: 1.1em;
        list-style: disc;
    }

    li + li {
        margin-top: 2px;
    }
</style>
