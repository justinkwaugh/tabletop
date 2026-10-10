<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import { BattleRole } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { GroupSprite } from '$lib/utils/pieceLayout.js'
    import Block from './Block.svelte'
    import CommanderFlag from './CommanderFlag.svelte'

    const gameSession = getGameSession()

    const sprites = $derived(gameSession.sprites)

    const NAMED_SHIFT = 16
    const LEADING_SHIFT = 34

    function drawnOut(role: BattleRole | undefined, angle: number): Point {
        if (role === undefined) {
            return { x: 0, y: 0 }
        }
        const distance = role === BattleRole.Leads ? LEADING_SHIFT : NAMED_SHIFT
        const radians = (angle * Math.PI) / 180
        return { x: -Math.cos(radians) * distance, y: -Math.sin(radians) * distance }
    }

    function pick(event: Event, unitId: string, pickable: boolean) {
        if (pickable) {
            event.stopPropagation()
            gameSession.pickBattleUnit(unitId)
        }
    }

    function select(event: Event, sprite: GroupSprite) {
        if (gameSession.canSelect(sprite.group)) {
            event.stopPropagation()
            gameSession.selectGroup(sprite.group)
        }
    }
</script>

<g filter="url(#nt-contact-shadow)">
    {#each sprites as sprite (sprite.group.key)}
        {@const colors = gameSession.armyColors(sprite.group.playerId)}
        {@const selectable = gameSession.canSelect(sprite.group)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <g
            class:nt-selectable={selectable}
            role={selectable ? 'button' : undefined}
            tabindex={selectable ? 0 : undefined}
            aria-label={selectable ? 'Select these pieces' : undefined}
            data-commander={sprite.group.commander?.id ?? 'detached'}
            onclick={(event) => select(event, sprite)}
            onkeydown={(event) => event.key === 'Enter' && select(event, sprite)}
        >
            {#each sprite.blocks as block (block.unit.id)}
                {@const mark = gameSession.blockMark(block.unit, sprite.group.key)}
                {@const offset = drawnOut(mark.role, block.angle)}
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <g
                    class:nt-selectable={mark.pickable}
                    role={mark.pickable ? 'button' : undefined}
                    tabindex={mark.pickable ? 0 : undefined}
                    aria-label={mark.pickable ? 'Choose this unit' : undefined}
                    aria-pressed={mark.pickable ? mark.role !== undefined : undefined}
                    onclick={(event) => pick(event, block.unit.id, mark.pickable)}
                    onkeydown={(event) =>
                        event.key === 'Enter' && pick(event, block.unit.id, mark.pickable)}
                >
                    <Block
                        x={block.centre.x + offset.x}
                        y={block.centre.y + offset.y}
                        angle={block.angle}
                        {colors}
                        face={gameSession.visibleFace(block.unit)}
                        dimmed={mark.dimmed}
                        spent={mark.spent}
                        leading={mark.role === BattleRole.Leads}
                    />
                </g>
            {/each}
        </g>
    {/each}
</g>
{#if gameSession.selectedSprite}
    {@const sprite = gameSession.selectedSprite}
    <circle
        cx={sprite.centre.x}
        cy={sprite.centre.y}
        r={sprite.radius + 10}
        class="nt-selection-ring"
    ></circle>
{/if}
{#each sprites as sprite (sprite.group.key)}
    {#if sprite.group.commander && sprite.flag}
        <CommanderFlag
            at={sprite.flag}
            rotation={gameSession.boardRotation}
            name={commanderDefinition(sprite.group.commander.id).name}
            colors={gameSession.armyColors(sprite.group.playerId)}
            count={sprite.group.units.length}
            faces={sprite.group.units.flatMap((unit) => gameSession.visibleFace(unit) ?? [])}
            spent={gameSession.hasCommanded(sprite.group)}
        />
    {/if}
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
