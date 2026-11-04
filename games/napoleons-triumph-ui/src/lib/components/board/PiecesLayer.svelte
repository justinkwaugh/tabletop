<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { lossMark } from '$lib/model/roleMark.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/blockShape.js'
    import type { GroupSprite } from '$lib/utils/pieceLayout.js'
    import Block from './Block.svelte'

    const gameSession = getGameSession()

    const sprites = $derived(gameSession.sprites)

    const POINTED_MARGIN = 4

    function tap(event: Event, sprite: GroupSprite, unitId: string, pickable: boolean) {
        if (pickable) {
            event.stopPropagation()
            gameSession.pickBattleUnit(unitId)
        } else if (gameSession.canSelect(sprite.group)) {
            event.stopPropagation()
            gameSession.tapBlock(sprite.group, unitId)
        } else if (pointsAtLoss(sprite, unitId, pickable)) {
            event.stopPropagation()
            gameSession.toggleLoss(unitId)
        }
    }

    function pointsAtLoss(sprite: GroupSprite, unitId: string, pickable: boolean): boolean {
        return !pickable && taskOf(sprite) === undefined && gameSession.marksLoss(unitId)
    }

    function hover(event: PointerEvent, unitId: string | undefined) {
        if (event.pointerType === 'mouse') {
            gameSession.hoverLoss(unitId)
        }
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    function select(event: Event, sprite: GroupSprite) {
        if (gameSession.canSelect(sprite.group)) {
            event.stopPropagation()
            gameSession.selectGroup(sprite.group)
        } else if (gameSession.mayAimAt(sprite.group.position.locale)) {
            event.stopPropagation()
            gameSession.aimAt(sprite.group.position.locale)
        } else if (gameSession.maySpread(sprite)) {
            event.stopPropagation()
            gameSession.toggleSpread(sprite)
        }
    }

    function taskOf(sprite: GroupSprite): string | undefined {
        if (gameSession.canSelect(sprite.group)) {
            return 'Select these pieces'
        }
        const { locale } = sprite.group.position
        if (gameSession.mayAimAt(locale)) {
            return gameSession.aimTask(locale)
        }
        if (gameSession.maySpread(sprite)) {
            return sprite.closedUp ? 'Spread these pieces out' : 'Close these pieces up'
        }
        return undefined
    }
</script>

{#each sprites as sprite (sprite.group.key)}
    {@const colors = gameSession.armyColors(sprite.group.playerId)}
    {@const task = taskOf(sprite)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <g
        filter="url(#nt-contact-shadow)"
        class:nt-selectable={task !== undefined}
        role={task ? 'button' : undefined}
        tabindex={task ? 0 : undefined}
        aria-label={task}
        data-commander={sprite.group.commander?.id ?? 'detached'}
        data-group={sprite.group.key}
        onclick={(event) => select(event, sprite)}
        onkeydown={(event) => event.key === 'Enter' && select(event, sprite)}
    >
        {#each sprite.blocks as block (block.unit.id)}
            {@const {
                pickable,
                role: battleRole,
                roleMark,
                dimmed,
                moved
            } = gameSession.blockMark(block.unit, sprite.group.key)}
            {@const pointing = pointsAtLoss(sprite, block.unit.id, pickable)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <g
                class:nt-selectable={pickable || pointing}
                role={pickable || pointing ? 'button' : undefined}
                tabindex={pickable || pointing ? 0 : undefined}
                aria-label={pickable
                    ? 'Choose this unit'
                    : pointing
                      ? 'A unit that lost steps'
                      : undefined}
                aria-pressed={pickable
                    ? battleRole !== undefined
                    : pointing
                      ? gameSession.pointedLossId === block.unit.id
                      : undefined}
                onpointerenter={(event) => pointing && hover(event, block.unit.id)}
                onpointerleave={(event) => pointing && hover(event, undefined)}
                onclick={(event) => tap(event, sprite, block.unit.id, pickable)}
                onkeydown={(event) =>
                    event.key === 'Enter' && tap(event, sprite, block.unit.id, pickable)}
            >
                <Block
                    x={block.centre.x}
                    y={block.centre.y}
                    angle={block.angle}
                    {colors}
                    {...gameSession.lookOnTheMap(block.unit)}
                    {dimmed}
                    {moved}
                    {roleMark}
                    viewRotation={gameSession.boardRotation}
                />
            </g>
        {/each}
    </g>
{/each}
{#each gameSession.ghostLinks as link (link.unitId)}
    <g class="nt-ghost-link" data-ghost-link>
        <line x1={link.line[0].x} y1={link.line[0].y} x2={link.line[1].x} y2={link.line[1].y}
        ></line>
        <circle cx={link.line[1].x} cy={link.line[1].y} r="3"></circle>
    </g>
{/each}
{#each gameSession.battleGhosts as ghost (ghost.block.unit.id)}
    {@const unitId = ghost.block.unit.id}
    <g
        class="nt-selectable"
        role="button"
        tabindex="0"
        aria-label="Where a unit lost steps"
        aria-pressed={gameSession.pointedLossId === unitId}
        data-battle-ghost={unitId}
        onpointerenter={(event) => hover(event, unitId)}
        onpointerleave={(event) => hover(event, undefined)}
        onclick={(event) => {
            event.stopPropagation()
            gameSession.toggleLoss(unitId)
        }}
        onkeydown={(event) => onKey(event, () => gameSession.toggleLoss(unitId))}
    >
        <Block
            x={ghost.block.centre.x}
            y={ghost.block.centre.y}
            angle={ghost.block.angle}
            colors={gameSession.armyColors(ghost.block.unit.playerId)}
            face={gameSession.knownFaceOnTheMap(ghost.loss.face)}
            ghost
            struck={ghost.loss.eliminated}
            roleMark={lossMark(ghost.loss.steps)}
            viewRotation={gameSession.boardRotation}
        />
    </g>
{/each}
{#snippet ring(sprite: GroupSprite, guard: boolean)}
    <circle
        cx={sprite.centre.x}
        cy={sprite.centre.y}
        r={sprite.radius + 10}
        class="nt-selection-ring"
        class:nt-guard-ring={guard}
        data-guard-ring={guard ? sprite.group.key : undefined}
    ></circle>
{/snippet}

{#each gameSession.ringedSprites as sprite (sprite.group.key)}
    {#if sprite.group.key !== gameSession.guardSprite?.group.key}
        {@render ring(sprite, false)}
    {/if}
{/each}
{#if gameSession.guardSprite}
    {@render ring(gameSession.guardSprite, true)}
{/if}
{#each gameSession.pointedLossBlocks as block, index (index)}
    <rect
        transform="translate({block.centre.x} {block.centre.y}) rotate({block.angle})"
        x={-BLOCK_LENGTH / 2 - POINTED_MARGIN}
        y={-BLOCK_THICKNESS / 2 - POINTED_MARGIN}
        width={BLOCK_LENGTH + POINTED_MARGIN * 2}
        height={BLOCK_THICKNESS + POINTED_MARGIN * 2}
        rx="3"
        class="nt-selection-ring"
        data-pointed-loss
    ></rect>
{/each}

<style>
    .nt-selectable {
        cursor: pointer;
    }

    .nt-selection-ring {
        fill: none;
        stroke: #2b2620;
        stroke-width: 3;
        stroke-dasharray: 4 6;
        pointer-events: none;
    }

    .nt-ghost-link {
        fill: #2b2620;
        stroke: #2b2620;
        opacity: 0.75;
        pointer-events: none;
    }

    .nt-ghost-link circle {
        stroke: none;
    }

    .nt-ghost-link line {
        stroke-width: 2;
        stroke-dasharray: 5 4;
        stroke-linecap: round;
    }

    .nt-guard-ring {
        stroke: #7a1418;
        stroke-width: 5;
        stroke-dasharray: 7 6;
    }
</style>
