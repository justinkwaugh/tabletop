<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LyngkVariant, variantFromConfig } from '@tabletop/lyngk'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const stackOfSix = $derived(variantFromConfig(session.game.config) === LyngkVariant.StackOfSix)

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
            <h3>Moving</h3>
            <ul>
                <li>
                    Move one piece or stack topped by a neutral colour or one you claimed, onto an
                    adjacent piece or one reached in a straight line over empty points. Never jump a
                    piece.
                </li>
                <li>
                    A stack holds at most {stackOfSix ? 'six' : 'five'} pieces, no two of one colour.
                    A white joker stands for any colour missing{stackOfSix ? ', or for white' : ''},
                    and never moves on its own.
                </li>
                <li>
                    Neutral on top: a single only onto another single; a stack only onto one no
                    taller.
                </li>
                <li>Your colour on top: onto any piece or stack.</li>
            </ul>
        </section>
        <section>
            <h3>Claiming</h3>
            <p>
                Before your move you may claim one neutral colour, two in all. Only you may then
                move pieces and stacks topped by it.
            </p>
        </section>
        <section>
            <h3>The LYNGK-rule</h3>
            <p>
                A move with your claimed colour that reaches another piece topped by the same colour
                carries on from it with another move. Each such point is used once a turn.
            </p>
        </section>
        <section>
            <h3>Scoring</h3>
            {#if stackOfSix}
                <p>
                    Stacks of five stay on the board. Complete a stack of six topped by your colour
                    and you win at once.
                </p>
            {:else}
                <p>
                    Complete a stack of five topped by your colour and it leaves the board as a
                    point. A neutral top leaves it standing as an obstacle.
                </p>
            {/if}
            <p class="note">
                When neither player can move, most stacks of five wins, then stacks of four, three,
                two and singles.
            </p>
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
        border: 1px solid var(--lyngk-panel-edge);
        border-radius: 0.5rem;
        background: var(--lyngk-panel);
        box-shadow: var(--lyngk-panel-shadow);
        color: var(--lyngk-ink);
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
        color: var(--lyngk-ink-quiet);
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

    .note {
        margin-top: 4px;
    }
</style>
