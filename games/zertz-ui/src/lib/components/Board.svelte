<script lang="ts">
    import { fade } from 'svelte/transition'
    import type { Attachment } from 'svelte/attachments'
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import type { MarbleColor, Ring } from '@tabletop/zertz'
    import MarbleLook from './MarbleLook.svelte'
    import RingLook from './RingLook.svelte'
    import StagedMarble from './StagedMarble.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { placementSeed, seedAt } from '$lib/board/marbleSeeds.js'
    import { coordsKey, RING_MID_RADIUS, RING_OUTER_RADIUS, TILT } from '$lib/board/geometry.js'
    import {
        MARBLE_SHADOW_RADIUS,
        MARBLE_SHADOW_STOPS,
        RING_SHADOW_RADIUS,
        RING_SHADOW_STOPS
    } from '$lib/board/softShadow.js'

    const session = getGameSession()

    const animator = new BoardAnimator(session)

    const view = $derived(session.view)
    const frame = $derived(view.frame(session.gameState.setup))
    const rings = $derived(animator.rings)
    // Far rings first, so nearer rings and their marbles stand in front of them.
    const drawOrder = $derived(
        rings.toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    )
    // Where rings were taken off, and where rings are sliding out or back in, under them.
    const removedPositions = $derived.by(() => {
        const present = new Set(rings.map((ring) => coordsKey(ring.coords)))
        return frame.positions.filter(
            (coords) => !present.has(coordsKey(coords)) || animator.sliding.has(coordsKey(coords))
        )
    })

    const SHADOW_COLOR = '#021624'
    const MARBLE_SHADOW_OPACITY = 0.55
    const RING_SHADOW_OPACITY = 0.6

    let hoveredKey: string | undefined = $state()
    let focusedKey: string | undefined = $state()

    // Marks lie round a ring's base, just inside its outer edge, so they never reach the touching
    // neighbours. Dashed marks take a whole number of dashes round the ring.
    const MARK_RADIUS = RING_OUTER_RADIUS - 2
    const DASH_PERIOD = 8
    const MARK_PATH = DASH_PERIOD * Math.round(ellipseLength(MARK_RADIUS, TILT) / DASH_PERIOD)
    const MARK_FADE_IN = 120
    const MARK_FADE_OUT = 280

    // Ramanujan's approximation to the length round an ellipse `radius` wide, `tilt` as deep.
    function ellipseLength(radius: number, tilt: number): number {
        const [a, b] = [radius, radius * tilt]
        return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
    }

    // Every vacant ring takes a marble, so placing marks none; the hovered ring previews it.
    function marked(role: RingRole): boolean {
        return role !== undefined && role !== 'place'
    }

    type RingRole = 'place' | 'staged' | 'remove' | 'land' | 'jumper' | 'chosen-jumper' | undefined

    function roleOf(ring: Ring): RingRole {
        const { coords } = ring
        if (includesCoords(session.removableRings, coords)) return 'remove'
        if (isStaged(coords) && session.canChangeStagedColor) return 'staged'
        if (includesCoords(session.landingRings, coords)) return 'land'
        if (session.chosenJumper && sameCoordinates(session.chosenJumper, coords))
            return 'chosen-jumper'
        if (includesCoords(session.jumpers, coords)) return 'jumper'
        if (includesCoords(session.placementRings, coords)) return 'place'
        return undefined
    }

    function isStaged(coords: AxialCoordinates): boolean {
        return session.chosenPlace !== undefined && sameCoordinates(session.chosenPlace, coords)
    }

    // The marble you are placing stands in the ring you chose, until it goes in. One Undo took
    // back out stands there already.
    const staged = $derived.by(() => {
        if (animator.placedIn) return undefined
        if (animator.returned) return { ...animator.returned, drops: false }
        const coords = session.chosenPlace
        const color = session.chosenColor
        if (coords === undefined || color === undefined) return undefined
        return {
            coords,
            color,
            seed: placementSeed(coords, session.gameState.actionCount),
            drops: true
        }
    })

    function activate(ring: Ring, role: RingRole) {
        if (role === 'staged') {
            void session.changeStagedColor()
        } else if (role === 'jumper' || role === 'chosen-jumper') {
            session.chooseJumper(ring.coords)
        } else if (role !== undefined) {
            void session.chooseRing(ring.coords)
        }
    }

    function onKey(event: KeyboardEvent, ring: Ring, role: RingRole) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(ring, role)
        }
    }

    function hover(event: PointerEvent, coords: AxialCoordinates) {
        // A tap enters and leaves at once, so touch would only flash the preview.
        if (event.pointerType !== 'touch') hoveredKey = coordsKey(coords)
    }

    function isHovered(coords: AxialCoordinates): boolean {
        return hoveredKey === coordsKey(coords)
    }

    // A tap on nothing you can choose lets go of what is chosen. Marbles pass taps to their
    // rings without being buttons, so both are marked interactive.
    function onBoardClick(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest('.interactive')) return
        session.letGo()
    }
</script>

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="zertz-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="ZÈRTZ board"
    onclick={onBoardClick}
    {@attach animator.attach}
>
    <defs>
        <!-- Soft shadows as gradients rather than a blur filter, which is slow to paint on phones. -->
        <radialGradient id="zertz-marble-shadow">
            {#each MARBLE_SHADOW_STOPS as stop, index (index)}
                <stop
                    offset={stop.offset}
                    stop-color={SHADOW_COLOR}
                    stop-opacity={stop.opacity * MARBLE_SHADOW_OPACITY}
                ></stop>
            {/each}
        </radialGradient>
        <radialGradient id="zertz-ring-shadow">
            {#each RING_SHADOW_STOPS as stop, index (index)}
                <stop
                    offset={stop.offset}
                    stop-color={SHADOW_COLOR}
                    stop-opacity={stop.opacity * RING_SHADOW_OPACITY}
                ></stop>
            {/each}
        </radialGradient>
    </defs>

    {#snippet ringShadow(coords: AxialCoordinates)}
        {@const center = view.center(coords)}
        <g transform="translate({center.x} {center.y + 3 + view.band}) scale(1 {view.tilt})">
            <circle r={RING_SHADOW_RADIUS} fill="url(#zertz-ring-shadow)"></circle>
        </g>
    {/snippet}

    <!-- Drawn at the marble's centre, which sits above its ring; the shadow falls on the ring. -->
    {#snippet marble(
        color: MarbleColor,
        seed: number,
        body?: Attachment<SVGGElement>,
        shadow?: Attachment<SVGGElement>
    )}
        <g transform="translate(0 {view.lift + 3 * view.tilt})">
            <g {@attach shadow}>
                <ellipse
                    rx={MARBLE_SHADOW_RADIUS}
                    ry={MARBLE_SHADOW_RADIUS * view.tilt}
                    fill="url(#zertz-marble-shadow)"
                ></ellipse>
            </g>
        </g>
        <g {@attach body}>
            <MarbleLook {color} {seed} {view} />
        </g>
    {/snippet}

    {#if session.showCoordinates}
        <g class="coordinate-labels">
            {#each session.notation.labels as label (label.key)}
                <text x={label.at.x} y={label.at.y}>{label.text}</text>
            {/each}
        </g>
    {/if}

    <!-- A removed ring takes its shadow with it as it is pulled out. -->
    <g>
        {#each rings as ring (coordsKey(ring.coords))}
            <g {@attach animator.ringShadow(coordsKey(ring.coords))}>
                {@render ringShadow(ring.coords)}
            </g>
        {/each}
    </g>

    <!-- Where a ring stood on the table: round its base, which lies below its hole's rim. -->
    {#each removedPositions as coords (coordsKey(coords))}
        {@const center = view.center(coords)}
        <ellipse
            cx={center.x}
            cy={center.y + view.band}
            rx={RING_MID_RADIUS}
            ry={RING_MID_RADIUS * view.tilt}
            class="ghost"
        ></ellipse>
    {/each}

    {#each drawOrder as ring (coordsKey(ring.coords))}
        {@const center = view.center(ring.coords)}
        {@const role = roleOf(ring)}
        {@const interactive = role !== undefined}
        <g transform="translate({center.x} {center.y})">
            <g
                class="ring role-{role ?? 'none'}"
                class:interactive
                class:hovered={interactive && isHovered(ring.coords)}
                {@attach animator.ring(coordsKey(ring.coords))}
                role="button"
                tabindex={interactive ? 0 : -1}
                aria-disabled={!interactive}
                aria-label="{role ?? 'ring'} {session.notation.name(ring.coords)}"
                onclick={() => activate(ring, role)}
                onkeydown={(event) => onKey(event, ring, role)}
                onpointerenter={(event) => hover(event, ring.coords)}
                onpointerleave={() => (hoveredKey = undefined)}
                onfocus={(event) => {
                    if (event.currentTarget.matches(':focus-visible'))
                        focusedKey = coordsKey(ring.coords)
                }}
                onblur={() => (focusedKey = undefined)}
            >
                <g transform="translate(0 {view.band}) scale(1 {view.tilt})">
                    <circle r={RING_OUTER_RADIUS} class="ring-hit"></circle>
                </g>
                <RingLook {view} />
            </g>
        </g>
    {/each}

    <!-- Outlines sit above the rings rather than in them, so a ring is pulled out without its outline. The
         animator fades the whole layer with each move, and every new position gets a fresh one. -->
    {#key session.gameState}
        <g {@attach animator.outlines()}>
            {#each rings as ring (coordsKey(ring.coords))}
                {@const role = roleOf(ring)}
                {#if marked(role)}
                    {@const center = view.center(ring.coords)}
                    {@const emphasized =
                        isHovered(ring.coords) || focusedKey === coordsKey(ring.coords)}
                    <!-- Round the ring's base, which spreads past its top. Once a jumper is
                         chosen, the others fade. -->
                    <g
                        class="mark role-{role}"
                        class:emphasized
                        class:faded={role === 'jumper' && session.chosenJumper !== undefined}
                        in:fade|global={{ duration: MARK_FADE_IN }}
                        out:fade={{ duration: MARK_FADE_OUT }}
                    >
                        <ellipse
                            cx={center.x}
                            cy={center.y + view.band}
                            rx={MARK_RADIUS}
                            ry={MARK_RADIUS * view.tilt}
                            pathLength={MARK_PATH}
                        ></ellipse>
                    </g>
                {/if}
            {/each}
        </g>
    {/key}

    <!-- Marbles stand above every ring and outline. A marble reaches beyond its own ring, so it
         passes pointing on to its ring. -->
    {#each drawOrder as ring (coordsKey(ring.coords))}
        {@const center = view.center(ring.coords)}
        {@const role = roleOf(ring)}
        {#if ring.marble}
            <g
                transform="translate({center.x} {center.y - view.lift})"
                class="marble"
                class:interactive={role !== undefined}
                role="presentation"
                onclick={() => activate(ring, role)}
                onpointerenter={(event) => hover(event, ring.coords)}
                onpointerleave={() => (hoveredKey = undefined)}
            >
                {@render marble(
                    ring.marble,
                    seedAt(animator.seeds, ring.coords),
                    animator.marble(coordsKey(ring.coords)),
                    animator.marbleShadow(coordsKey(ring.coords))
                )}
            </g>
        {:else if staged && sameCoordinates(staged.coords, ring.coords)}
            <!-- Choosing it again, while there is another colour to place, changes its colour:
                 the marble lifts out and the next drops in. -->
            {#key staged.color}
                <g
                    transform="translate({center.x} {center.y - view.lift})"
                    class="marble"
                    class:interactive={role !== undefined}
                    role="presentation"
                    onclick={() => activate(ring, role)}
                    onpointerenter={(event) => hover(event, ring.coords)}
                    onpointerleave={() => (hoveredKey = undefined)}
                >
                    <StagedMarble
                        color={staged.color}
                        seed={staged.seed}
                        {view}
                        drops={staged.drops}
                        lifts={() => !animator.placedIn}
                    />
                </g>
            {/key}
        {:else if role === 'place' && session.chosenColor && isHovered(ring.coords)}
            <g class="preview" transform="translate({center.x} {center.y - view.lift})">
                <MarbleLook
                    color={session.chosenColor}
                    seed={placementSeed(ring.coords, session.gameState.actionCount)}
                    {view}
                />
            </g>
        {/if}
    {/each}

    {#if animator.flight}
        {@const center = view.center(animator.flight.from)}
        <g transform="translate({center.x} {center.y - view.lift})" class="flight">
            <g {@attach animator.flier()}>
                {@render marble(
                    animator.flight.color,
                    animator.flight.seed,
                    animator.flierBody(),
                    animator.flierShadow()
                )}
            </g>
        </g>
    {/if}
</svg>

<style>
    .zertz-board {
        overflow: visible;
        user-select: none;
    }

    .ghost {
        fill: none;
        stroke: rgb(255 255 255 / 0.16);
        stroke-width: 2;
        stroke-dasharray: 4 5;
    }

    .coordinate-labels {
        pointer-events: none;
        fill: var(--zertz-ink-quiet);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
    }

    .ring-hit {
        fill: transparent;
    }

    /* Choice marks are cyan, as in every title. The other titles lay them on a dark band so they
       read on light pieces too; here every mark lies on a black ring, so the band would not show.
       Pieces that move take a solid mark, thicker once chosen; rings to land on or remove take
       dashes, whole while pointed at. */
    .mark {
        fill: none;
        stroke: var(--zertz-mark);
        stroke-width: 1.8;
        pointer-events: none;
    }

    .mark.faded {
        opacity: 0.4;
    }

    .mark.role-chosen-jumper,
    .mark.role-staged {
        stroke-width: 3;
    }

    .mark.role-land,
    .mark.role-remove {
        stroke-width: 2.6;
        stroke-dasharray: 4.5 3.5;
    }

    .mark.emphasized {
        stroke-dasharray: none;
    }

    .ring {
        outline: none;
    }

    .interactive {
        cursor: pointer;
    }

    .preview {
        opacity: 0.55;
        pointer-events: none;
    }

    .flight {
        pointer-events: none;
    }
</style>
