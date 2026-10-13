<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import boardArt from '$lib/images/board.webp'
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
    import { replayFlags } from '$lib/model/moveReplay.js'
    import { roleMarkOf } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { viewTransformInSvg } from '$lib/utils/boardView.js'
    import { attackMarkerScale } from '$lib/utils/attackMarker.js'
    import { flagScale } from '$lib/utils/flagLayout.js'
    import ApproachBars from './board/ApproachBars.svelte'
    import AttackArrow from './board/AttackArrow.svelte'
    import Block from './board/Block.svelte'
    import CommanderFlag from './board/CommanderFlag.svelte'
    import ContactShadow from './board/ContactShadow.svelte'
    import HeldApproaches from './board/HeldApproaches.svelte'
    import WayArrow from './board/WayArrow.svelte'
    import SwelledRule from './SwelledRule.svelte'

    const gameSession = getGameSession()

    const SHADOW = 'nt-replay-shadow'
    let mapWidth = $state(0)

    const replay = $derived(gameSession.moveReplay)
    const scene = $derived(gameSession.moveReplayScene)
    const rotation = $derived(gameSession.boardRotation)
    const zoom = $derived(scene && mapWidth > 0 ? mapWidth / scene.focus.width : 1)
    const flagView = $derived({ rotation, scale: flagScale(zoom) })
    const flags = $derived(
        scene ? replayFlags(scene, flagView, (group) => gameSession.flagBearer(group, false)) : []
    )

    const shownAsModal: Attachment<HTMLDialogElement> = (dialog) => {
        dialog.showModal()
    }

    const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

    // The host steps the game through its history on the arrow keys, from a listener on the window; under the sheet that would move the table the sheet promises to leave alone.
    function keepArrowKeys(event: KeyboardEvent) {
        if (!replay || !ARROW_KEYS.includes(event.key)) {
            return
        }
        event.stopPropagation()
        if (event.key === 'ArrowLeft') {
            gameSession.stepMoveReplay(-1)
        } else if (event.key === 'ArrowRight') {
            gameSession.stepMoveReplay(1)
        }
    }

    // Workaround: the second click of a double-click on a history entry lands on the backdrop of the sheet the first one opened.
    function dismiss(event: MouseEvent & { currentTarget: HTMLDialogElement }) {
        if (event.target === event.currentTarget && event.detail <= 1) {
            event.currentTarget.close()
        }
    }
</script>

<svelte:window onkeydowncapture={keepArrowKeys} />

{#if replay && scene}
    <dialog
        class="nt-replay"
        aria-label="An action from the history"
        {@attach shownAsModal}
        onclose={() => gameSession.closeMoveReplay()}
        onclick={dismiss}
    >
        <div class="nt-replay-sheet">
            <header>
                <div class="nt-replay-time">{replay.time}</div>
                <div class="nt-replay-controls">
                    <button
                        type="button"
                        class="nt-replay-step"
                        aria-label="The action before"
                        disabled={!gameSession.earlierReplay}
                        onclick={() => gameSession.stepMoveReplay(-1)}
                    >
                        <svg viewBox="0 0 10 16" aria-hidden="true"
                            ><path d="M8 2 L2 8 L8 14"></path></svg
                        >
                    </button>
                    <button
                        type="button"
                        class="nt-replay-step"
                        aria-label="The action after"
                        disabled={!gameSession.laterReplay}
                        onclick={() => gameSession.stepMoveReplay(1)}
                    >
                        <svg viewBox="0 0 10 16" aria-hidden="true"
                            ><path d="M2 2 L8 8 L2 14"></path></svg
                        >
                    </button>
                    <form method="dialog">
                        <button class="nt-replay-close">Close</button>
                    </form>
                </div>
                <h2>{replay.text}</h2>
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
                                    {...gameSession.lookOf(block.unit)}
                                    dimmed
                                />
                            {/each}
                        </g>
                        {#each scene.sprites as sprite (sprite.group.key)}
                            <g filter="url(#{SHADOW})">
                                {#each sprite.blocks as block (block.unit.id)}
                                    {@const role = scene.roles[block.unit.id]}
                                    <Block
                                        x={block.centre.x}
                                        y={block.centre.y}
                                        angle={block.angle}
                                        colors={gameSession.armyColors(block.unit.playerId)}
                                        {...gameSession.lookOf(block.unit)}
                                        roleMark={role && roleMarkOf(role)}
                                        dimmed={scene.bystanderIds.includes(block.unit.id)}
                                    />
                                {/each}
                            </g>
                        {/each}
                        {#each scene.arrows as arrow, index (index)}
                            <WayArrow {arrow} />
                        {/each}
                        {#each flags as flag (flag.key)}
                            <CommanderFlag {flag} view={flagView} />
                        {/each}
                        {#if scene.attackMark}
                            <AttackArrow mark={scene.attackMark} scale={attackMarkerScale(zoom)} />
                        {/if}
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
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        column-gap: 16px;
    }

    .nt-replay-time {
        font-size: 13px;
        opacity: 0.7;
    }

    h2 {
        grid-column: 1 / -1;
        font-size: 19px;
        font-style: italic;
        line-height: 1.25;
    }

    .nt-replay-controls {
        display: flex;
        flex: none;
        align-items: center;
        gap: 4px;
    }

    .nt-replay-step {
        display: grid;
        place-items: center;
        width: 34px;
        height: 30px;
        border-radius: 4px;
        cursor: pointer;
    }

    .nt-replay-step svg {
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .nt-replay-step:hover:not([disabled]) {
        background: color-mix(in srgb, var(--nt-ink) 9%, transparent);
    }

    .nt-replay-step[disabled] {
        opacity: 0.3;
        cursor: default;
    }

    .nt-replay-close {
        margin-left: 8px;
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

    footer {
        display: flex;
        justify-content: flex-end;
    }

    @media (max-width: 639px) {
        .nt-replay-sheet {
            padding: 10px 10px 8px;
        }

        h2 {
            min-height: 2.5em;
            font-size: 16px;
        }

        .nt-replay-step {
            width: 40px;
            height: 34px;
        }
    }
</style>
