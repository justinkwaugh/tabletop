<script lang="ts">
    import {
        TECHS,
        TurnStep,
        canAffordTech,
        isTechAvailable,
        techCost,
        type TechDefinition
    } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART, TECH_TREE_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TECH_EFFECT_TEXT } from '$lib/utils/presentation.js'
    import { TECH_CHART_HEIGHT, TECH_CHART_WIDTH, techBox } from '$lib/utils/techChartLayout.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId)
    const developing = $derived(gameSession.actingStep === TurnStep.Development)

    function owners(tech: TechDefinition) {
        return gameState.players.filter((player) => player.ownsTech(tech.id))
    }

    function choosable(tech: TechDefinition): boolean {
        return (
            developing &&
            playerId !== undefined &&
            isTechAvailable(gameState, playerId, tech.id) &&
            canAffordTech(gameState, playerId, tech.id)
        )
    }

    function mine(tech: TechDefinition): boolean {
        return playerId !== undefined && gameState.getPlayerState(playerId).ownsTech(tech.id)
    }
</script>

<svg
    width={TECH_CHART_WIDTH}
    height={TECH_CHART_HEIGHT}
    viewBox="0 0 {TECH_CHART_WIDTH} {TECH_CHART_HEIGHT}"
    aria-label="Tech chart"
>
    <image href={TECH_TREE_ART} width={TECH_CHART_WIDTH} height={TECH_CHART_HEIGHT}></image>
    {#each TECHS as tech (tech.id)}
        {@const box = techBox(tech)}
        {@const canChoose = choosable(tech)}
        {@const selected = gameSession.selectedTech === tech.id}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
            class="tech"
            class:choosable={canChoose}
            role="button"
            tabindex="-1"
            aria-label={tech.name}
            onclick={() => canChoose && gameSession.selectTech(tech.id)}
        >
            <title>{tech.name}: {TECH_EFFECT_TEXT[tech.id]}</title>
            <rect
                class="frame"
                class:mine={mine(tech)}
                class:selected
                x={box.x - 3}
                y={box.y - 3}
                width={box.width + 6}
                height={box.height + 6}
                rx="8"
            ></rect>
            {#each owners(tech) as owner, index (owner.playerId)}
                {#if owner.faction}
                    <image
                        href={FACTION_ART[owner.faction]}
                        x={box.x + box.width - 30 - index * 30}
                        y={box.y + 4}
                        width="28"
                        height="28"
                    ></image>
                {/if}
            {/each}
            {#if canChoose && playerId}
                <g transform="translate({box.x + 8} {box.y + box.height - 10})">
                    <rect x="-4" y="-24" width="92" height="30" rx="6" class="cost-bg"></rect>
                    <text class="cost" y="-2">Cost {techCost(gameState, playerId, tech.id)}</text>
                </g>
            {/if}
        </g>
    {/each}
</svg>

<style>
    .frame {
        fill: transparent;
        stroke: transparent;
        stroke-width: 4px;
    }

    .frame.mine {
        stroke: #f2c94c;
    }

    .tech.choosable {
        cursor: pointer;
    }

    .tech.choosable .frame {
        stroke: #7fd3ff;
        fill: rgba(127, 211, 255, 0.08);
    }

    .tech.choosable:hover .frame {
        fill: rgba(127, 211, 255, 0.22);
    }

    .frame.selected,
    .tech.choosable .frame.selected {
        stroke: #ffd65a;
        stroke-width: 8px;
        fill: rgba(255, 214, 90, 0.16);
    }

    .cost-bg {
        fill: rgba(5, 7, 13, 0.85);
    }

    .cost {
        font-size: 20px;
        font-weight: 700;
        fill: #7fd3ff;
    }
</style>
