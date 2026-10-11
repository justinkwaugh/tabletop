<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import boardArt from '$lib/images/board.webp'
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
    import { replayFlags } from '$lib/model/moveReplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { viewTransformInSvg } from '$lib/utils/boardView.js'
    import { flagScale } from '$lib/utils/flagLayout.js'
    import { ARROW_HEAD_LENGTH } from '$lib/utils/wayArrow.js'
    import ApproachBars from './board/ApproachBars.svelte'
    import Block from './board/Block.svelte'
    import CommanderFlag from './board/CommanderFlag.svelte'
    import ContactShadow from './board/ContactShadow.svelte'
    import HeldApproaches from './board/HeldApproaches.svelte'
    import SwelledRule from './SwelledRule.svelte'

    const gameSession = getGameSession()

    const SHADOW = 'nt-replay-shadow'
    const SHAFT_WIDTH = 11
    const CASING = 3
    const ARROW_HEAD = `M0 0 L${-ARROW_HEAD_LENGTH} -17 L${-ARROW_HEAD_LENGTH} 17 Z`

    let mapWidth = $state(0)

    const replay = $derived(gameSession.moveReplay)
    const scene = $derived(gameSession.moveReplayScene)
    const rotation = $derived(gameSession.boardRotation)
    const flagView = $derived({
        rotation,
        scale: scene && mapWidth > 0 ? flagScale(mapWidth / scene.focus.width) : 1
    })
    const flags = $derived(
        scene ? replayFlags(scene, flagView, (group) => gameSession.flagBearer(group, false)) : []
    )

    const shownAsModal: Attachment<HTMLDialogElement> = (dialog) => {
        dialog.showModal()
    }

    // Workaround: the second click of a double-click on a history entry lands on the backdrop of the sheet the first one opened.
    function dismiss(event: MouseEvent & { currentTarget: HTMLDialogElement }) {
        if (event.target === event.currentTarget && event.detail <= 1) {
            event.currentTarget.close()
        }
    }
</script>

{#if replay && scene}
    <dialog
        class="nt-replay"
        aria-label="A move from the history"
        {@attach shownAsModal}
        onclose={() => gameSession.closeMoveReplay()}
        onclick={dismiss}
    >
        <div class="nt-replay-sheet">
            <header>
                <div>
                    <div class="nt-replay-time">{replay.time}</div>
                    <h2>{replay.text}</h2>
                </div>
                <form method="dialog">
                    <button class="nt-replay-close">Close</button>
                </form>
            </header>
            <SwelledRule />
            <div class="nt-replay-map" bind:clientWidth={mapWidth}>
                <svg
                    viewBox="{scene.focus.x} {scene.focus.y} {scene.focus.width} {scene.focus
                        .height}"
                    font-family="'Libre Baskerville', Georgia, serif"
                    role="img"
                    aria-label={replay.text}
                >
                    <defs>
                        <ContactShadow id={SHADOW} />
                    </defs>
                    <g transform={viewTransformInSvg(rotation)}>
                        <image href={boardArt} width={BOARD_WIDTH} height={BOARD_HEIGHT}></image>
                        <ApproachBars />
                        <g class="nt-replay-held">
                            <HeldApproaches approaches={scene.held} />
                        </g>
                        <g class="nt-replay-left">
                            {#each scene.left as block (block.unit.id)}
                                <Block
                                    x={block.centre.x}
                                    y={block.centre.y}
                                    angle={block.angle}
                                    colors={gameSession.armyColors(block.unit.playerId)}
                                    face={gameSession.visibleFace(block.unit)}
                                    dimmed
                                />
                            {/each}
                        </g>
                        <g filter="url(#{SHADOW})">
                            {#each scene.sprites as sprite (sprite.group.key)}
                                {#each sprite.blocks as block (block.unit.id)}
                                    <Block
                                        x={block.centre.x}
                                        y={block.centre.y}
                                        angle={block.angle}
                                        colors={gameSession.armyColors(block.unit.playerId)}
                                        face={gameSession.visibleFace(block.unit)}
                                    />
                                {/each}
                            {/each}
                        </g>
                        {#each scene.arrows as arrow, index (index)}
                            {@const head = `translate(${arrow.tip.x} ${arrow.tip.y}) rotate(${arrow.angle}) scale(${arrow.scale})`}
                            {@const shaft = arrow.shaft
                                .map((point) => `${point.x},${point.y}`)
                                .join(' ')}
                            <g class="nt-replay-way" stroke-width={SHAFT_WIDTH * arrow.scale}>
                                <polyline
                                    points={shaft}
                                    class="nt-replay-way-casing"
                                    stroke-width={(SHAFT_WIDTH + CASING * 2) * arrow.scale}
                                ></polyline>
                                <path
                                    d={ARROW_HEAD}
                                    transform={head}
                                    class="nt-replay-way-casing"
                                    stroke-width={CASING * 2}
                                ></path>
                                <polyline points={shaft}></polyline>
                                <path d={ARROW_HEAD} transform={head} stroke="none"></path>
                            </g>
                        {/each}
                        {#each flags as flag (flag.key)}
                            <CommanderFlag {flag} view={flagView} />
                        {/each}
                    </g>
                </svg>
            </div>
            <footer>
                <button
                    type="button"
                    class="nt-replay-visit"
                    onclick={() => gameSession.visitMoveReplay()}
                    >See the whole game at this point</button
                >
            </footer>
        </div>
    </dialog>
{/if}

<style>
    .nt-replay {
        --nt-ground: #f9f6ee;
        width: min(900px, 94vw);
        max-width: none;
        max-height: 94dvh;
        margin: auto;
        padding: 0;
        border: 0;
        border-radius: 5px;
        background: var(--nt-ground);
        color: var(--nt-ink);
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .nt-replay::backdrop {
        background: rgba(43, 38, 32, 0.55);
    }

    .nt-replay-sheet {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px 18px 12px;
    }

    header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
    }

    .nt-replay-time {
        font-size: 13px;
        opacity: 0.7;
    }

    h2 {
        font-size: 19px;
        font-style: italic;
        line-height: 1.25;
    }

    .nt-replay-close,
    .nt-replay-visit {
        font-size: 15px;
        font-style: italic;
        cursor: pointer;
    }

    .nt-replay-close:hover,
    .nt-replay-visit:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    .nt-replay-map {
        align-self: center;
        width: min(100%, calc(68dvh * 4 / 3));
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border-radius: 3px;
    }

    .nt-replay-map svg {
        display: block;
        width: 100%;
        height: 100%;
    }

    .nt-replay-way {
        fill: none;
        stroke: #2b2620;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .nt-replay-way path {
        fill: #2b2620;
    }

    .nt-replay-way .nt-replay-way-casing {
        fill: #f1ecdc;
        stroke: #f1ecdc;
    }

    .nt-replay-way polyline.nt-replay-way-casing {
        fill: none;
    }

    footer {
        display: flex;
        justify-content: flex-end;
    }

    @media (max-width: 639px) {
        .nt-replay-sheet {
            padding: 10px 10px 8px;
        }

        h2 {
            font-size: 16px;
        }
    }
</style>
