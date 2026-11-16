<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { assertExists, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { SPACES, spaceKey, spaceName } from '@tabletop/dvonn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { VIEW, viewFor } from '$lib/board/geometry.js'
    import { boardLines } from '$lib/board/boardLines.js'
    import { badgeTop, markOn, targetOutline } from '$lib/board/marks.js'
    import { LABEL_SHIFT } from '$lib/board/coordinates.js'
    import { PIECE_MODEL, stackDiscs, TILT, topFaceY } from '$lib/board/pieceGeometry.js'
    import { CONTACT_SHADE, holeFloor, throughLens } from '$lib/board/pieceShape.js'
    import { SAND_SIZE } from '$lib/board/sandTexture.js'
    import { seedKeyOf } from '$lib/board/pieceStyle.js'
    import sand from '$lib/images/sand.webp'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import StackShape from './StackShape.svelte'
    import { badgeSpot, type BadgeSpot } from '$lib/board/badgeSpot.js'
    import HeightBadge from './HeightBadge.svelte'

    const session = getGameSession()

    // On a phone the board grows into the labels' room while they are hidden.
    const phone = new MediaQuery('width < 40rem')
    const layout = $derived.by(() => {
        const labelled = session.showCoordinates || !phone.current
        return viewFor(session.graphBoard, labelled, session.turned)
    })
    const radius = VIEW.radius

    const lines = $derived(boardLines(layout))

    const imprintRadius = $derived(radius * 1.03)

    const animator = new BoardAnimator(session, () => layout)

    // Back to front, so a nearer stack covers the one behind it.
    const stacks = $derived(
        animator.stacks.toSorted((a, b) => {
            const pa = layout.center(a.coords)
            const pb = layout.center(b.coords)
            return pa.y - pb.y || pa.x - pb.x
        })
    )

    // A stack's height shows on a badge while badges are on, and always on a stack shrunk past the
    // full height, whose height cannot be seen.
    function badgeShown(height: number): boolean {
        return height > 1 && (session.heightBadges || height > session.pieceModel.cap)
    }

    // Each badge at the far right of its stack's top, or wherever nearer stacks leave it seen.
    const badgeSpots = $derived.by(() => {
        const base = stackDiscs(1, radius)[0].base
        const standing = stacks.map((stack) => {
            const center = layout.center(stack.coords)
            const model = animator.modelAt(stack.key)
            return {
                center,
                top: center.y + topFaceY(stack.pieces.length, radius, model),
                base: center.y + base
            }
        })
        const spots = new Map<string, BadgeSpot>()
        stacks.forEach((stack, index) => {
            if (!badgeShown(stack.pieces.length)) return
            spots.set(stack.key, badgeSpot(standing[index], standing.slice(index + 1), radius))
        })
        return spots
    })

    function stackId(key: string): string {
        return `dvonn-stack-${key}`
    }

    function heightAt(coords: AxialCoordinates): number {
        return session.gameState.board.stackAt(coords).length
    }

    type Role = 'movable' | 'chosen' | 'destination'

    function roleOf(coords: AxialCoordinates): Role | undefined {
        if (includesCoords(session.destinations, coords)) return 'destination'
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        if (includesCoords(session.movable, coords) && !session.chosenFrom) return 'movable'
        return undefined
    }

    // Far first, so where a nearer stack's outline overlaps one behind, the nearer one takes the tap.
    const clickable = $derived(
        SPACES.filter((coords) => session.isClickable(coords)).toSorted((a, b) => {
            const pa = layout.center(a)
            const pb = layout.center(b)
            return pa.y - pb.y || pa.x - pb.x
        })
    )

    function describe(coords: AxialCoordinates): string {
        const name = spaceName(coords)
        if (includesCoords(session.placeable, coords)) return `place on ${name}`
        switch (roleOf(coords)) {
            case 'destination':
                return `move onto ${name}`
            case 'chosen':
                return `put back ${name}`
            default:
                return `stack ${name}`
        }
    }

    // A tap on nothing you can choose lets go of what is chosen.
    function onBoardClick(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest('.target')) return
        session.letGo()
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    const shadowRx = $derived(radius + 3)
    // The stack's shadow at its darkest.
    const SHADOW_SHADE = 0.32
    const HOLE_FLOOR = holeFloor(SHADOW_SHADE, CONTACT_SHADE)

    // The sand's grain, rendered at the sand's own size, centred on it.
    const grain = $derived({
        x: layout.sandBox.x + (layout.sandBox.width - SAND_SIZE.width) / 2,
        y: layout.sandBox.y + (layout.sandBox.height - SAND_SIZE.height) / 2
    })

    function spotOf(key: string): BadgeSpot {
        const spot = badgeSpots.get(key)
        assertExists(spot, `No badge on ${key}`)
        return spot
    }
</script>

<!-- A stack's shadow on the board, and right under it the board in its shade, which shows through
     the gap under the bottom piece. Down a short stack's hole, where light falls straight in, the
     board is in less shade. -->
{#snippet shadow(height: number)}
    {@const through = throughLens(height, radius)}
    <g clip-path={through ? `url(#dvonn-board-around-hole-${height})` : undefined}>
        <ellipse cx="1.5" cy="2" rx={shadowRx} ry={shadowRx * TILT} fill="url(#dvonn-shadow)"
        ></ellipse>
        <ellipse rx={radius} ry={radius * TILT} fill="url(#dvonn-board-contact)"></ellipse>
    </g>
    {#if through}
        <path d={through} fill="#000000" fill-opacity={HOLE_FLOOR}></path>
    {/if}
{/snippet}

{#snippet drawn(stack: DrawnStack)}
    {@const center = layout.center(stack.coords)}
    {@const role = roleOf(stack.coords)}
    <g id={stackId(stack.key)} transform="translate({center.x} {center.y})" class="piece">
        <g {@attach animator.stack(stack.key, 'whole')}>
            <g {@attach animator.stack(stack.key, 'shadow')}>
                {@render shadow(stack.pieces.length)}
            </g>
            <g {@attach animator.stack(stack.key, 'body')}>
                <StackShape
                    tones={stack.pieces.map((piece) => session.toneOfPiece(piece))}
                    seedKeys={stack.pieces.map(seedKeyOf)}
                    {radius}
                    prefix="dvonn-board"
                    model={animator.modelAt(stack.key)}
                    turned={layout.turned}
                />
            </g>
        </g>
        <!-- A mark recolors a ring on top of the stack. It is drawn with its stack, so
             nearer stacks cover it as they cover the pieces, but outside the stack's moving
             group: it fades with the move rather than travelling with the stack. -->
        {#if role}
            {@const ring = markOn(stack.pieces.length, radius, session.pieceModel)}
            <g class="rim role-{role}" {@attach animator.mark()}>
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse cy={ring.y} rx={ring.rx} ry={ring.ry} class={layer}></ellipse>
                {/each}
            </g>
        {/if}
        <!-- The height badge over the ring, moving with the stack's body. -->
        {#if badgeSpots.has(stack.key)}
            <g {@attach animator.stack(stack.key, 'badge')}>
                <HeightBadge
                    height={stack.pieces.length}
                    spot={spotOf(stack.key)}
                    top={badgeTop(stack.pieces.length, radius, animator.modelAt(stack.key))}
                    {radius}
                />
            </g>
        {/if}
    </g>
{/snippet}

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<div class="tap-off" role="presentation" onclick={onBoardClick}>
    <svg
        class="dvonn-board"
        class:graph={session.graphBoard}
        viewBox={layout.viewBox}
        width={layout.frame.width}
        height={layout.frame.height}
        role="group"
        aria-label="DVONN board"
        {@attach animator.attach}
    >
        <defs>
            <PieceDefs prefix="dvonn-board" {radius} />
            <clipPath id="dvonn-sand-clip">
                <path d={layout.sandOutline}></path>
            </clipPath>
            <!-- Soft shadows as gradients rather than a blur filter: WebKit leaves the pixels of a
             removed piece under a filter on screen until something else repaints there. -->
            <radialGradient id="dvonn-shadow">
                <stop offset="0.72" stop-color="#000" stop-opacity={SHADOW_SHADE}></stop>
                <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
            </radialGradient>
            <!-- A pressed ring: shaded on its far side, lit on its near side. -->
            <linearGradient id="dvonn-imprint" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#6f675a" stop-opacity="0.55"></stop>
                <stop offset="0.5" stop-color="#6f675a" stop-opacity="0.08"></stop>
                <stop offset="1" stop-color="#ffffff" stop-opacity="0.7"></stop>
            </linearGradient>
            <linearGradient id="dvonn-imprint-hole" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"></stop>
                <stop offset="1" stop-color="#6f675a" stop-opacity="0.45"></stop>
            </linearGradient>
        </defs>

        {#if session.graphBoard}
            <polygon points={layout.hull} class="play-area"></polygon>
            <g class="lines">
                {#each lines as line, index (index)}
                    <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
                {/each}
            </g>
        {:else}
            <path d={layout.sandOutline} class="sand"></path>
            <!-- The grain, rendered once by scripts/render-sand.mjs at the sand's own size, so it
             covers the sand without a browser's fitting. -->
            <image
                href={sand}
                x={grain.x}
                y={grain.y}
                width={SAND_SIZE.width}
                height={SAND_SIZE.height}
                clip-path="url(#dvonn-sand-clip)"
                class="grain"
            ></image>
            <g class="imprints">
                {#each SPACES as coords (spaceKey(coords))}
                    {@const center = layout.center(coords)}
                    <g transform="translate({center.x} {center.y})">
                        <ellipse
                            rx={imprintRadius}
                            ry={imprintRadius * TILT}
                            stroke="url(#dvonn-imprint)"
                            class="imprint"
                        ></ellipse>
                        <ellipse
                            rx={imprintRadius * PIECE_MODEL.hole}
                            ry={imprintRadius * PIECE_MODEL.hole * TILT}
                            stroke="url(#dvonn-imprint-hole)"
                            class="imprint"
                        ></ellipse>
                    </g>
                {/each}
            </g>
        {/if}

        {#if session.showCoordinates}
            {#each layout.labels as label (label.key)}
                <text x={label.at.x} y={label.at.y} dy={LABEL_SHIFT} class="coordinate-label"
                    >{label.text}</text
                >
            {/each}
        {/if}

        {#each stacks as stack (stack.key)}
            {@render drawn(stack)}
        {/each}

        <!-- The stacks in flight, each with its badge, which moves with its body. -->
        {#each animator.fliers as flier (flier.key)}
            {@const center = layout.center(flier.coords)}
            <g transform="translate({center.x} {center.y})" class="flier">
                <g {@attach animator.flierNode(flier.key, 'whole')}>
                    <g {@attach animator.flierNode(flier.key, 'shadow')}>
                        {@render shadow(flier.pieces.length)}
                    </g>
                    <g {@attach animator.flierNode(flier.key, 'body')}>
                        <StackShape
                            tones={flier.pieces.map((piece) => session.toneOfPiece(piece))}
                            seedKeys={flier.pieces.map(seedKeyOf)}
                            {radius}
                            prefix="dvonn-board"
                            turned={layout.turned}
                        />
                        {#if badgeShown(flier.pieces.length)}
                            <HeightBadge
                                height={flier.pieces.length}
                                spot="right"
                                top={badgeTop(flier.pieces.length, radius, PIECE_MODEL)}
                                {radius}
                            />
                        {/if}
                    </g>
                </g>
            </g>
        {/each}
        <!-- Each stack again over a lone flier, shown while it stands in front of it. -->
        {#if animator.fliers.length === 1}
            {@const flier = animator.fliers[0]}
            <g class="occluders" aria-hidden="true">
                {#each stacks as stack (stack.key)}
                    {#if !flier.passes.includes(stack.key)}
                        <use href="#{stackId(stack.key)}" {@attach animator.occluder(stack)}></use>
                    {/if}
                {/each}
            </g>
        {/if}

        <g class="targets">
            {#each clickable as coords (spaceKey(coords))}
                {@const center = layout.center(coords)}
                <path
                    d={targetOutline(heightAt(coords), radius, session.pieceModel)}
                    transform="translate({center.x} {center.y})"
                    class="target"
                    role="button"
                    tabindex="0"
                    aria-label={describe(coords)}
                    onclick={() => session.chooseSpace(coords)}
                    onkeydown={(event) => onKey(event, () => session.chooseSpace(coords))}
                ></path>
            {/each}
        </g>
    </svg>
</div>

<style>
    .tap-off {
        display: contents;
    }

    .dvonn-board {
        overflow: visible;
        user-select: none;
    }

    .sand {
        fill: var(--dvonn-sand);
        stroke: var(--dvonn-sand-edge);
        stroke-width: 1.5;
    }

    .grain,
    .imprints {
        pointer-events: none;
    }

    .imprint {
        fill: none;
        stroke-width: 2.2;
    }

    .play-area {
        fill: var(--dvonn-play);
    }

    .lines line {
        stroke-linecap: butt;
        stroke: var(--dvonn-line);
        stroke-width: 1.4;
    }

    /* Centred by `dy` on the alphabetic baseline, and spaced in user units: WebKit misplaces a
       central baseline and Safari em lengths under the board's zoom. */
    .coordinate-label {
        fill: var(--dvonn-label);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-anchor: middle;
        pointer-events: none;
    }

    .piece,
    .flier,
    .occluders {
        pointer-events: none;
    }

    /* Two-tone, a dark band under a bright core, so a mark reads on every color. */
    .rim ellipse {
        fill: none;
    }

    .rim .under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 3.6;
    }

    .rim .over {
        stroke: var(--dvonn-mark);
        stroke-width: 1.8;
    }

    .rim.role-chosen .under {
        stroke-width: 5;
    }

    .rim.role-chosen .over {
        stroke-width: 3;
    }

    .rim.role-destination .over {
        stroke-width: 2.6;
        stroke-dasharray: 4.5 3.5;
    }

    /* Each dash outlined on its own rather than laid on a band, so the piece shows between
       dashes: the black dashes are shorter but square-capped, overhanging each cyan dash by the
       outline's width at both ends. */
    .rim.role-destination .under {
        stroke: #000;
        stroke-width: 4.4;
        stroke-dasharray: 1.9 6.1;
        stroke-dashoffset: -1.3;
        stroke-linecap: square;
    }

    .target {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .target:focus-visible {
        stroke: var(--dvonn-mark);
        stroke-width: 1.4;
    }
</style>
