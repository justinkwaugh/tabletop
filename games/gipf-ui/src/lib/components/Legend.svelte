<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { Color } from '@tabletop/common'
    import { GipfVersion, versionFromConfig } from '@tabletop/gipf'
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
    const version = $derived(versionFromConfig(session.game.config))

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
        {#if version !== GipfVersion.Basic}
            <section>
                <h3>Pieces</h3>
                <dl>
                    <div class="entry">
                        <dt><PieceIcon {color} size={38} /></dt>
                        <dd>
                            <strong>Single piece</strong> Must go when a row it is in is taken.
                        </dd>
                    </div>
                    <div class="entry">
                        <dt><PieceIcon {color} gipf={true} size={38} /></dt>
                        <dd>
                            <strong>GIPF-&#8288;piece</strong> Two pieces stacked. It may stay when its
                            row is taken. Lose your last one and you lose.
                        </dd>
                    </div>
                </dl>
            </section>
        {/if}
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>
                    Push one piece in from a dot onto the next spot. Pieces in the way slide along
                    the line; a full line can't be pushed.
                </li>
                {#if version === GipfVersion.Standard}
                    <li>Your three GIPF-&#8288;pieces start on the board.</li>
                {:else if version === GipfVersion.Tournament}
                    <li>
                        Your first piece is a GIPF-&#8288;piece. Bring in as many as you like before
                        your first single piece.
                    </li>
                {/if}
            </ul>
        </section>
        <section>
            <h3>Rows of four</h3>
            <ul>
                <li>
                    Four or more of one colour in a line are taken by their owner, with any pieces
                    that carry the line on without a gap.
                </li>
                {#if version !== GipfVersion.Basic}
                    <li>Single pieces must go; GIPF-&#8288;pieces may stay.</li>
                {/if}
                <li>
                    Your own pieces return to your reserve{version === GipfVersion.Basic
                        ? ''
                        : ', a GIPF-\u2060piece as two'}. Your opponent's are captured.
                </li>
                <li>The mover takes their rows first, then the opponent.</li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>
                {#if version === GipfVersion.Basic}
                    Leave your opponent with no piece to push in.
                {:else}
                    Leave your opponent with no GIPF-&#8288;piece on the board, or with no piece to
                    push in.
                {/if}
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
        border: 2px solid var(--gipf-panel-edge);
        border-radius: 0.5rem;
        background: linear-gradient(var(--gipf-panel), var(--gipf-panel)) #091326;
        box-shadow: var(--gipf-panel-shadow);
        color: var(--gipf-ink);
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
        color: var(--gipf-ink-quiet);
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
        grid-template-columns: 38px 1fr;
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
