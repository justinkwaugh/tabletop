<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { Color } from '@tabletop/common'
    import { PieceKind } from '@tabletop/matrx'
    import PieceIcon from './PieceIcon.svelte'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const color = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id).color : Color.White
    )

    const POWERS: { kind: PieceKind; name: string; power: string }[] = [
        {
            kind: PieceKind.Tamsk,
            name: 'TAMSK',
            power: 'When pushed onto E5 by either player, its owner brings the top potential in again as an extra move: at once if they pushed it, before their next move if the opponent did.'
        },
        {
            kind: PieceKind.Zertz,
            name: 'ZÈRTZ',
            power: 'Jumps over a line of one or more adjacent pieces to the first empty spot beyond.'
        },
        {
            kind: PieceKind.Dvonn,
            name: 'DVONN',
            power: 'Jumps onto an opponent’s DVONN potential, adjacent or across empty spots, and holds that spot until it is removed.'
        },
        {
            kind: PieceKind.Yinsh,
            name: 'YINSH',
            power: 'Slides any distance along a line, stopping before the first occupied spot (no jumping).'
        },
        {
            kind: PieceKind.Punct,
            name: 'PÜNCT',
            power: 'Jumps onto an opponent’s PÜNCT potential, adjacent or across empty spots, and holds that spot until it is removed.'
        }
    ]

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
            <h3>Potentials</h3>
            <dl>
                {#each POWERS as { kind, name, power } (kind)}
                    <div class="entry">
                        <dt><PieceIcon {color} {kind} discs={2} size={30} /></dt>
                        <dd><strong>{name}</strong> {power}</dd>
                    </div>
                {/each}
            </dl>
        </section>
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>
                    Bring your GIPF pieces in first, one a turn, including any taken back into your
                    reserve.
                </li>
                <li>
                    Then either bring in a stack of two potentials of one kind, or move the top
                    potential of a stack on the board by its power.
                </li>
                <li>
                    To bring a piece in, push it from a dot onto the next spot. Pieces in the way
                    slide along the line; a full line can't be pushed.
                </li>
                <li>Moving a potential splits its stack into two used singles with no power.</li>
            </ul>
        </section>
        <section>
            <h3>Rows of four</h3>
            <ul>
                <li>
                    Four or more of one colour in a line are taken by their owner, with any pieces
                    that carry the line on without a gap.
                </li>
                <li>Singles must go. Stacks of two may stay, but a row of four must be broken.</li>
                <li>
                    Your own pieces return to your reserve, where two singles of a kind pair up
                    again. Your opponent's are captured.
                </li>
                <li>The mover takes their rows first, then the opponent.</li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>Capture all three of your opponent's GIPF pieces, or leave them without a move.</p>
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
        border: 2px solid var(--matrx-card-edge);
        border-radius: 0.5rem;
        background: var(--matrx-card);
        box-shadow: var(--matrx-panel-shadow);
        color: var(--matrx-card-ink);
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
        color: var(--matrx-ink-quiet);
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

    dl {
        display: grid;
        gap: 6px;
    }

    .entry {
        display: grid;
        grid-template-columns: 30px 1fr;
        align-items: start;
        gap: 10px;
    }

    dt {
        display: flex;
        justify-content: center;
    }

    dd {
        padding-top: 2px;
    }

    strong {
        font-weight: 700;
    }
</style>
