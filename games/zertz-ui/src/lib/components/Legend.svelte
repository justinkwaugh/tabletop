<script lang="ts">
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARBLE_COLORS, MarbleColor, SETUP_RULES, setupFromConfig } from '@tabletop/zertz'
    import MarbleIcon from './MarbleIcon.svelte'

    // A (?) chip that opens a short rules reference.
    let { reference }: { reference: string } = $props()

    const session = getGameSession()
    const uid = $props.id()
    const chipId = `legend-${uid}`
    const OFFSET = 6

    const win = $derived(SETUP_RULES[setupFromConfig(session.game.config)].win)

    const NAMES: Record<MarbleColor, string> = {
        [MarbleColor.White]: 'white',
        [MarbleColor.Grey]: 'grey',
        [MarbleColor.Black]: 'black'
    }

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
            <h3>Winning sets</h3>
            <p>Capture or claim any one of these:</p>
            <div class="sets">
                {#each MARBLE_COLORS as color (color)}
                    <span class="set">
                        {#each { length: win.singleColor[color] }, index (index)}
                            <MarbleIcon {color} seed={index + 1} size={18} />
                        {/each}
                        <span class="set-name">{win.singleColor[color]} {NAMES[color]}</span>
                    </span>
                {/each}
                <span class="set">
                    {#each MARBLE_COLORS as color (color)}
                        {#each { length: win.eachColor }, index (index)}
                            <MarbleIcon {color} seed={index + 7} size={18} />
                        {/each}
                    {/each}
                    <span class="set-name">{win.eachColor} of each</span>
                </span>
            </div>
        </section>
        <section>
            <h3>Your turn</h3>
            <ul>
                <li>If you can capture, you must.</li>
                <li>
                    Otherwise place a marble of any colour from the pool on a vacant ring, then take
                    away a free ring: a vacant one at the edge that can slide out without moving the
                    others.
                </li>
                <li>Once the pool is empty, place marbles from your own captures.</li>
            </ul>
        </section>
        <section>
            <h3>Captures</h3>
            <ul>
                <li>
                    Jump a marble over an adjacent marble onto the vacant ring just beyond, and take
                    the marble jumped. Marbles belong to no one: jump with any colour.
                </li>
                <li>
                    The marble that jumped keeps jumping while it can. With a choice of captures,
                    take any.
                </li>
            </ul>
        </section>
        <section>
            <h3>Isolated rings</h3>
            <p>
                Taking away a ring that cuts off a group with a marble on every ring claims that
                group’s marbles. The player who fills the last vacant ring claims every ring left
                and wins.
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
        border: 2px solid var(--zertz-panel-edge);
        border-radius: 0.5rem;
        background: linear-gradient(var(--zertz-panel), var(--zertz-panel)) #082a44;
        box-shadow: var(--zertz-panel-shadow);
        color: var(--zertz-ink);
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
        color: var(--zertz-ink-quiet);
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

    .sets {
        display: grid;
        gap: 4px;
        margin-top: 4px;
    }

    .set {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
    }

    .set-name {
        margin-left: 6px;
        font-weight: 700;
    }
</style>
