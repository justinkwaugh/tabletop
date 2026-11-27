<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { Color } from '@tabletop/common'
    import {
        PieceKind,
        potentialsFromConfig,
        VERSION_RULES,
        versionFromConfig,
        type PotentialKind
    } from '@tabletop/gipf-potentials'
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
    const startsWithGipfPieces = $derived(
        VERSION_RULES[versionFromConfig(session.game.config)].startsWithGipfPieces
    )
    const counts = $derived(potentialsFromConfig(session.game.config))

    const NAMES: Record<PotentialKind, string> = {
        [PieceKind.Tamsk]: 'TAMSK',
        [PieceKind.Zertz]: 'ZÈRTZ',
        [PieceKind.Dvonn]: 'DVONN',
        [PieceKind.Yinsh]: 'YINSH',
        [PieceKind.Punct]: 'PÜNCT'
    }

    // A word joiner after each hyphen keeps names such as GIPF-piece whole when a line wraps.
    const POWERS: Record<PotentialKind, string> = {
        [PieceKind.Tamsk]:
            'When pushed onto the centre spot by either player, its owner brings the potential in again as an extra move: at once if they pushed it, before their next move if the opponent did.',
        [PieceKind.Zertz]:
            'Jumps over a line of one or more adjacent pieces to the first empty spot beyond.',
        [PieceKind.Dvonn]:
            'Jumps onto an opponent’s adjacent basic piece or DVONN-\u2060potential, never a GIPF-\u2060piece or another kind of potential, and holds that spot until it is removed.',
        [PieceKind.Yinsh]:
            'Slides any distance along a line, stopping before the first occupied spot (no jumping).',
        [PieceKind.Punct]:
            'Sacrifice it to cover an opponent’s adjacent GIPF-\u2060piece with one or two basic pieces (GIPF) from your supply, or jump onto an opponent’s adjacent PÜNCT-\u2060potential.'
    }

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
            <h3>Potentials in this game</h3>
            <dl>
                {#each session.kindsInPlay as kind (kind)}
                    <div class="entry">
                        <dt><PieceIcon {color} discs={[PieceKind.Basic, kind]} size={30} /></dt>
                        <dd>
                            <strong>{NAMES[kind]}</strong><span class="count">×{counts[kind]}</span>
                            {POWERS[kind]}
                        </dd>
                    </div>
                {/each}
            </dl>
        </section>
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>
                    Push one piece in from a dot onto the next spot, or use a potential on the
                    board. Pieces in the way slide along the line; a full line can't be pushed.
                </li>
                {#if startsWithGipfPieces}
                    <li>Your three GIPF-&#8288;pieces start on the board.</li>
                {:else}
                    <li>
                        Your first piece is a GIPF-&#8288;piece (two basic pieces). Bring in as many
                        as you like before your first other piece.
                    </li>
                {/if}
                <li>
                    Then push your potentials in, each on top of a basic piece, before your first
                    plain basic piece. Pushing a plain piece forfeits any left.
                </li>
                <li>
                    A potential works once: lift it off its piece and move it by its power. The
                    piece below stays as a plain basic piece.
                </li>
            </ul>
        </section>
        <section>
            <h3>Rows of four</h3>
            <ul>
                <li>
                    Four or more of one colour in a line are taken by their owner, with any pieces
                    that carry the line on without a gap.
                </li>
                <li>
                    Plain pieces and used potentials must go. GIPF-&#8288;pieces and loaded pieces
                    may stay, but a row of four with a loaded piece in it must be broken.
                </li>
                <li>
                    Your own basic pieces return to your reserve, a GIPF-&#8288;piece as two. Your
                    opponent's are captured. Potentials leave the game either way.
                </li>
                <li>The mover takes their rows first, then the opponent.</li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>
                Leave your opponent with no uncovered GIPF-&#8288;piece on the board, or without a
                move.
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
        border: 2px solid var(--gp-panel-edge);
        border-radius: 0.5rem;
        background: #0a1424;
        box-shadow: var(--gp-panel-shadow);
        color: var(--gp-ink);
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
        color: var(--gp-ink-quiet);
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

    .count {
        margin-left: 0.3em;
        color: var(--gp-ink-quiet);
        font-weight: 400;
    }
</style>
