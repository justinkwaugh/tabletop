<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        Side,
        commanderDefinition,
        commandersOf,
        type HydratedNapoleonsTriumphPlayerState,
        type ProjectedUnit
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ArmyColors } from '$lib/utils/armyColors.js'
    import { commandsUsed } from '$lib/utils/commandsLeft.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/blockShape.js'
    import Block from './board/Block.svelte'
    import UnitFace from './UnitFace.svelte'
    import { BLOCK_SYMBOL_HEIGHT, BLOCK_SYMBOL_WIDTH } from '$lib/utils/faceLayout.js'
    import { eliteCommitments } from '$lib/utils/eliteCommitments.js'
    import { armyObjectives } from '$lib/utils/armyObjectives.js'
    import StarMark from './StarMark.svelte'

    let { onlocate }: { onlocate: (locale: number) => void } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const ELITE_SWATCH_WIDTH = BLOCK_SYMBOL_WIDTH + 8
    const ELITE_SWATCH_HEIGHT = BLOCK_SYMBOL_HEIGHT + 6

    const ARMY_NAMES: Record<Side, string> = {
        [Side.French]: 'Grande Armée',
        [Side.Allied]: 'Allied Army'
    }

    const armies = $derived(
        game.players.flatMap((player) => (player.side ? [{ player, side: player.side }] : []))
    )

    function unitCount(units: ProjectedUnit[]): string {
        return units.length === 1 ? '1 unit' : `${units.length} units`
    }

    function whereabouts(commanderId: string): { place: string; locale?: number } {
        const commander = game.commander(commanderId)
        if (commander.eliminated) {
            return { place: 'destroyed' }
        }
        if (!commander.position) {
            return { place: 'off the map' }
        }
        const { locale, approach } = commander.position
        const name = game.map.label(locale)
        return { place: approach === undefined ? name : `${name}, on an approach`, locale }
    }
</script>

{#snippet elites(player: HydratedNapoleonsTriumphPlayerState, colors: ArmyColors)}
    <div
        class="nt-army-elites"
        style:--nt-elite-ink={colors.ink}
        style:--nt-elite-block={colors.block}
    >
        {#each eliteCommitments(player) as elite (elite.id)}
            <div class="nt-elite" class:nt-elite-committed={elite.committed}>
                <svg
                    viewBox="{-ELITE_SWATCH_WIDTH / 2} {-ELITE_SWATCH_HEIGHT /
                        2} {ELITE_SWATCH_WIDTH} {ELITE_SWATCH_HEIGHT}"
                    aria-hidden="true"
                >
                    <rect
                        x={-ELITE_SWATCH_WIDTH / 2}
                        y={-ELITE_SWATCH_HEIGHT / 2}
                        width={ELITE_SWATCH_WIDTH}
                        height={ELITE_SWATCH_HEIGHT}
                        rx={2}
                        fill={colors.block}
                    ></rect>
                    <UnitFace
                        face={elite.face}
                        ink={colors.ink}
                        ground={colors.block}
                        symbolWidth={BLOCK_SYMBOL_WIDTH}
                        symbolHeight={BLOCK_SYMBOL_HEIGHT}
                    />
                </svg>
                <span class="nt-elite-name">{elite.name}</span>
                <span class="nt-elite-state" title={elite.explanation}>{elite.status}</span>
            </div>
        {/each}
    </div>
{/snippet}

{#snippet objectives(playerId: string)}
    {@const sought = armyObjectives(game, playerId, gameSession.starHolds)}
    <div class="nt-objectives">
        <div class="nt-objective-stars">
            {#each sought.stars as objective (objective.star)}
                <svg
                    viewBox="-1.15 -1.15 2.3 2.3"
                    role="img"
                    aria-label={objective.explanation}
                    class:nt-star-unheld={objective.hold === undefined}
                >
                    <title>{objective.explanation}</title>
                    <StarMark star={objective.star} hold={objective.hold} strokeWidth={0.13} />
                </svg>
            {/each}
        </div>
        <span class="nt-objective-terms">{sought.terms}</span>
    </div>
{/snippet}

{#snippet unitBlocks(units: ProjectedUnit[], colors: ArmyColors)}
    <div class="nt-corps-units">
        {#each gameSession.asRead(units) as unit (unit.id)}
            <svg
                viewBox="{-BLOCK_LENGTH / 2} {-BLOCK_THICKNESS /
                    2} {BLOCK_LENGTH} {BLOCK_THICKNESS}"
                role="img"
                aria-label="Unit"
            >
                <Block x={0} y={0} angle={0} {colors} {...gameSession.lookOf(unit)} />
            </svg>
        {/each}
    </div>
{/snippet}

<div class="nt-armies">
    {#each armies as { player, side } (player.playerId)}
        {@const colors = gameSession.armyColors(player.playerId)}
        {@const detached = game
            .unitsOf(player.playerId)
            .filter((unit) => unit.commanderId === undefined)}
        <section class="nt-army">
            <header style="background: {colors.block}; color: {colors.ink};">
                <div class="nt-army-name">{ARMY_NAMES[side]}</div>
                <div class="nt-army-player"><PlayerName playerId={player.playerId} /></div>
                <div class="nt-army-morale">
                    <span class="nt-army-morale-value" aria-label="{side} morale {player.morale}"
                        >{player.morale}</span
                    >
                    <span>morale</span>
                </div>
            </header>
            <div class="nt-army-body">
                {@render objectives(player.playerId)}
                {@render elites(player, colors)}
                {#if game.turnManager.currentTurn()?.playerId === player.playerId}
                    <div class="nt-army-note">
                        {commandsUsed(game, player.playerId)}
                    </div>
                {/if}
                {#each commandersOf(side) as definition (definition.id)}
                    {@const units = game.corpsUnits(definition.id)}
                    {@const where = whereabouts(definition.id)}
                    <div
                        class="nt-corps"
                        class:nt-corps-gone={game.commander(definition.id).eliminated}
                    >
                        <div class="nt-corps-head">
                            <span class="nt-corps-name"
                                >{commanderDefinition(definition.id).name}</span
                            >
                            {#if where.locale !== undefined}
                                {@const locale = where.locale}
                                <button
                                    type="button"
                                    class="nt-corps-where nt-corps-locate"
                                    aria-label="Show {definition.name} on the map"
                                    onclick={() => onlocate(locale)}
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <circle cx="8" cy="8" r="4.2"></circle>
                                        <path
                                            d="M8 0.8 V4.6 M8 11.4 V15.2 M0.8 8 H4.6 M11.4 8 H15.2"
                                        ></path>
                                    </svg>
                                    {where.place}
                                </button>
                            {:else}
                                <span class="nt-corps-where">{where.place}</span>
                            {/if}
                        </div>
                        {#if units.length > 0}
                            <div class="nt-corps-where nt-corps-count">{unitCount(units)}</div>
                            {@render unitBlocks(units, colors)}
                        {/if}
                    </div>
                {/each}
                {#if detached.length > 0}
                    <div class="nt-corps">
                        <div class="nt-corps-head">
                            <span class="nt-corps-name"
                                >{detached.some((unit) => unit.position)
                                    ? 'Detached'
                                    : 'To set up'}</span
                            >
                            <span class="nt-corps-where">{unitCount(detached)}</span>
                        </div>
                        {@render unitBlocks(detached, colors)}
                    </div>
                {/if}
            </div>
        </section>
    {/each}
</div>

<style>
    .nt-armies {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 2px;
        color: #2b2620;
        font-size: 13px;
    }

    .nt-army {
        border: 1px solid #2b2620;
        border-radius: 4px;
        overflow: hidden;
    }

    .nt-army header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        padding: 6px 10px;
        row-gap: 1px;
    }

    .nt-army-name {
        font-size: 17px;
        font-style: italic;
    }

    .nt-army-player {
        grid-column: 1;
        font-size: 12px;
        opacity: 0.9;
    }

    .nt-army-morale {
        grid-column: 2;
        grid-row: 1 / span 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 11px;
        line-height: 1;
    }

    .nt-army-morale-value {
        font-size: 26px;
        font-weight: 700;
    }

    .nt-army-body {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 6px 8px 8px;
    }

    .nt-army-note {
        font-size: 12px;
        opacity: 0.75;
    }

    .nt-army-elites {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 4px;
    }

    .nt-elite {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 6px 2px 2px;
        border: 1px solid color-mix(in srgb, var(--nt-ink) 30%, transparent);
        border-radius: 3px;
    }

    .nt-elite svg {
        flex: none;
        width: 24px;
        height: 17px;
    }

    .nt-elite-name {
        font-style: italic;
        white-space: nowrap;
    }

    .nt-elite-state {
        margin-left: auto;
        white-space: nowrap;
        font-size: 11px;
        opacity: 0.75;
    }

    .nt-elite-committed {
        border-color: var(--nt-elite-block);
        background: var(--nt-elite-block);
        color: var(--nt-elite-ink);
    }

    .nt-elite-committed .nt-elite-state {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 1;
    }

    .nt-objectives {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 3px 6px 3px 4px;
        border: 1px solid color-mix(in srgb, var(--nt-ink) 30%, transparent);
        border-radius: 3px;
    }

    .nt-objective-stars {
        flex: none;
        display: flex;
        gap: 3px;
    }

    .nt-objective-stars svg {
        flex: none;
        width: 19px;
        height: 19px;
    }

    .nt-star-unheld {
        opacity: 0.55;
    }

    .nt-objective-terms {
        margin-left: auto;
        font-size: 11px;
        opacity: 0.75;
        text-align: right;
    }

    .nt-corps-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        border-bottom: 1px solid rgba(43, 38, 32, 0.25);
    }

    .nt-corps-name {
        font-style: italic;
        font-size: 14px;
    }

    .nt-corps-where {
        font-size: 11px;
        opacity: 0.75;
        text-align: right;
    }

    .nt-corps-locate {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }

    .nt-corps-locate:hover {
        opacity: 1;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .nt-corps-locate svg {
        flex: none;
        width: 11px;
        height: 11px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
    }

    .nt-corps-count {
        padding-top: 2px;
        text-align: left;
    }

    .nt-corps-units {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3px 4px;
        padding-top: 4px;
    }

    .nt-corps-units svg {
        display: block;
        width: 100%;
        height: auto;
    }

    .nt-corps-gone {
        opacity: 0.45;
    }
</style>
