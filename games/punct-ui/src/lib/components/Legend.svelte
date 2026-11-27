<script lang="ts">
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { Color } from '@tabletop/common'
    import { PieceKind, Variant, variantFromConfig } from '@tabletop/punct'
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
    const standard = $derived(variantFromConfig(session.game.config) === Variant.Standard)

    const SHAPES: { kind: PieceKind; name: string }[] = [
        { kind: PieceKind.Triangle, name: 'Triangle' },
        { kind: PieceKind.StraightEnd, name: 'Straight' },
        { kind: PieceKind.AngleCorner, name: 'Angled' }
    ]

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
            <h3>Pieces</h3>
            <div class="shapes">
                {#each SHAPES as { kind, name } (kind)}
                    <span class="shape">
                        <PieceIcon {color} {kind} scale={0.3} ringRoom={false} />
                        <span>{name}</span>
                    </span>
                {/each}
            </div>
            <p class="note">
                Every piece covers three spaces. The marked dot is its PÜNCT; the straight and
                angled pieces come with it at the end, the middle or the corner.
            </p>
        </section>
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>
                    Place a new piece on three empty spaces{standard
                        ? ', never inside the central hexagon'
                        : '; only White’s first piece stays out of the central hexagon'}.
                </li>
                <li>
                    Or move one of yours: its PÜNCT goes any distance in a straight line, over
                    anything, and the piece may turn about it. Turning in place counts as a move.
                </li>
                <li>A piece with any dot covered can’t move.</li>
            </ul>
        </section>
        <section>
            <h3>Stacking and bridges</h3>
            <ul>
                <li>
                    A piece may rest on top of others when all its dots are at one level and its
                    PÜNCT lies on one of your own pieces.
                </li>
                <li>
                    A straight or angled piece can bridge a gap between its two ends. Nothing may go
                    into a space under a bridge.
                </li>
            </ul>
        </section>
        <section>
            <h3>Winning</h3>
            <p>
                Join two opposite sides of the board with a chain of your visible dots, at any
                levels. {standard
                    ? 'When a player places their last piece with no connection, more central spaces wins; equal counts draw.'
                    : 'When a player places their last piece with no connection, the game is undecided.'}
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
        border: 1px solid var(--punct-panel-edge);
        border-radius: 0.5rem;
        background: var(--punct-panel);
        box-shadow: var(--punct-panel-shadow);
        color: var(--punct-ink);
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
        color: var(--punct-ink-quiet);
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

    .shapes {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        align-items: center;
    }

    .shape {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 700;
    }

    .note {
        margin-top: 4px;
    }
</style>
