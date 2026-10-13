<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { GroupSprite } from '$lib/utils/pieceLayout.js'
    import Block from './Block.svelte'

    const gameSession = getGameSession()

    const sprites = $derived(gameSession.sprites)

    function tap(event: Event, sprite: GroupSprite, unitId: string, pickable: boolean) {
        if (pickable) {
            event.stopPropagation()
            gameSession.pickBattleUnit(unitId)
        } else if (gameSession.canSelect(sprite.group)) {
            event.stopPropagation()
            gameSession.tapBlock(sprite.group, unitId)
        }
    }

    function select(event: Event, sprite: GroupSprite) {
        if (gameSession.canSelect(sprite.group)) {
            event.stopPropagation()
            gameSession.selectGroup(sprite.group)
        } else if (gameSession.maySpread(sprite)) {
            event.stopPropagation()
            gameSession.toggleSpread(sprite)
        }
    }

    function taskOf(sprite: GroupSprite): string | undefined {
        if (gameSession.canSelect(sprite.group)) {
            return 'Select these pieces'
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
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <g
                class:nt-selectable={pickable}
                role={pickable ? 'button' : undefined}
                tabindex={pickable ? 0 : undefined}
                aria-label={pickable ? 'Choose this unit' : undefined}
                aria-pressed={pickable ? battleRole !== undefined : undefined}
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
                />
            </g>
        {/each}
    </g>
{/each}
{#each gameSession.ringedSprites as sprite (sprite.group.key)}
    <circle
        cx={sprite.centre.x}
        cy={sprite.centre.y}
        r={sprite.radius + 10}
        class="nt-selection-ring"
    ></circle>
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
</style>
