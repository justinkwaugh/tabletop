<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { Color } from '@tabletop/common'
    import { PieceKind } from '@tabletop/tzaar'
    import { toneOf } from '$lib/board/pieceStyle.js'
    import PieceIcon from './PieceIcon.svelte'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const tone = $derived(
        toneOf(
            session.myPlayer
                ? session.gameState.getPlayerState(session.myPlayer.id).color
                : Color.White
        )
    )

    const KINDS: { kind: PieceKind; name: string; count: number }[] = [
        { kind: PieceKind.Tzaar, name: 'Tzaars', count: 6 },
        { kind: PieceKind.Tzarra, name: 'Tzarras', count: 9 },
        { kind: PieceKind.Tott, name: 'Totts', count: 15 }
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
            <h3>Pieces</h3>
            <dl>
                {#each KINDS as { kind, name, count } (kind)}
                    <div class="entry">
                        <dt><PieceIcon {tone} {kind} size={34} /></dt>
                        <dd class="kind">
                            <strong>{name}</strong><span class="count">×{count}</span>
                        </dd>
                    </div>
                {/each}
            </dl>
            <p class="note">
                Keep at least one of each type on top of a stack: lose all your Tzaars, Tzarras or
                Totts from the tops of stacks and you lose.
            </p>
        </section>
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>
                    First capture: move one of your stacks in a straight line onto the first stack
                    it reaches, an opponent’s stack no taller than yours. The stack taken leaves the
                    game.
                </li>
                <li>
                    Then capture again, move a stack onto one of your own to make it taller, or
                    pass.
                </li>
                <li>
                    A stack moves over empty spaces only, never over another stack or the centre.
                </li>
                <li>White’s first turn is a single capture.</li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>
                Your opponent loses when one type is gone from the tops of their stacks, or when
                they can’t capture at the start of their turn.
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
        border: 1px solid var(--tzaar-panel-edge);
        border-radius: 0.5rem;
        background: var(--tzaar-panel);
        box-shadow: var(--tzaar-panel-shadow);
        color: var(--tzaar-ink);
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
        color: var(--tzaar-ink-quiet);
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
        grid-template-columns: 34px 1fr;
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
        color: var(--tzaar-ink-quiet);
        font-weight: 400;
    }

    .kind {
        padding-top: 7px;
    }

    .note {
        margin-top: 6px;
    }
</style>
