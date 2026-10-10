<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import { ARMY_COLORS } from '$lib/definitions/palette.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { GroupSprite } from '$lib/utils/pieceLayout.js'
    import Block from './Block.svelte'
    import CommanderFlag from './CommanderFlag.svelte'

    const gameSession = getGameSession()

    const sprites = $derived(gameSession.sprites)
    const pickedUnitIds = $derived(gameSession.pickedUnitIds)
    const roles = $derived(gameSession.battleRoles)
    const fighting = $derived(gameSession.attack !== undefined)

    // Pieces named in an attack are drawn out of their stack, leading units furthest.
    const NAMED_SHIFT = 16
    const LEADING_SHIFT = 34

    function shift(unitId: string, angle: number): { x: number; y: number } {
        const role = roles[unitId]
        if (role === undefined) {
            return { x: 0, y: 0 }
        }
        const distance = role === 'leads' ? LEADING_SHIFT : NAMED_SHIFT
        const radians = (angle * Math.PI) / 180
        return { x: -Math.cos(radians) * distance, y: -Math.sin(radians) * distance }
    }

    function pick(event: Event, unitId: string) {
        if (!gameSession.canPickInBattle(unitId)) {
            return
        }
        event.stopPropagation()
        gameSession.pickBattleUnit(unitId)
    }

    function select(event: Event, sprite: GroupSprite) {
        if (!gameSession.canSelect(sprite.group)) {
            return
        }
        event.stopPropagation()
        gameSession.selectGroup(sprite.group)
    }
</script>

<g filter="url(#nt-contact-shadow)">
    {#each sprites as sprite (sprite.group.key)}
        {@const colors = ARMY_COLORS[gameSession.gameState.sideOf(sprite.group.playerId)]}
        {@const selectable = gameSession.canSelect(sprite.group)}
        {@const selected = sprite.group.key === gameSession.selectedGroupKey}
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
                {@const pickable = gameSession.canPickInBattle(block.unit.id)}
                {@const offset = shift(block.unit.id, block.angle)}
                <g
                    class:nt-selectable={pickable}
                    role={pickable ? 'button' : undefined}
                    tabindex={pickable ? 0 : undefined}
                    aria-label={pickable ? 'Choose this unit' : undefined}
                    aria-pressed={pickable ? roles[block.unit.id] !== undefined : undefined}
                    onclick={(event) => pick(event, block.unit.id)}
                    onkeydown={(event) => event.key === 'Enter' && pick(event, block.unit.id)}
                >
                    <Block
                        x={block.centre.x + offset.x}
                        y={block.centre.y + offset.y}
                        angle={block.angle}
                        fill={colors.block}
                        shade={colors.shade}
                        ink={colors.ink}
                        face={gameSession.visibleFace(block.unit)}
                        dimmed={(selected && !pickedUnitIds.includes(block.unit.id)) ||
                            (fighting && !pickable && roles[block.unit.id] === undefined)}
                        spent={!fighting &&
                            block.unit.movesThisTurn !== undefined &&
                            gameSession.isMine(sprite.group)}
                        leading={roles[block.unit.id] === 'leads'}
                    />
                </g>
            {/each}
        </g>
    {/each}
</g>
{#if gameSession.selectedSprite}
    {@const sprite = gameSession.selectedSprite}
    <circle cx={sprite.centre.x} cy={sprite.centre.y} r={sprite.radius + 10} class="nt-selection-ring" />
{/if}
{#each sprites as sprite (sprite.group.key)}
    {#if sprite.group.commander && sprite.flag}
        <CommanderFlag
            at={sprite.flag}
            rotation={gameSession.boardRotation}
            name={commanderDefinition(sprite.group.commander.id).name}
            side={gameSession.gameState.sideOf(sprite.group.playerId)}
            count={sprite.group.units.length}
            faces={sprite.group.units.flatMap((unit) => gameSession.visibleFace(unit) ?? [])}
            spent={sprite.group.commander.commandsThisTurn !== undefined && gameSession.isMine(sprite.group)}
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
