<script lang="ts">
    import { APPROACH_GEOMETRY, ENTRY_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { localeOutlinePoints } from '$lib/map/localeOutline.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        TargetKind,
        TargetMark,
        markOf,
        type AttackTarget,
        type MoveTarget,
        type ReserveTarget,
        type RetreatTarget,
        type WayTarget
    } from '$lib/model/targets.js'
    import { WayStepKind } from '$lib/model/ways.js'
    import { targetBarBox } from '$lib/utils/targetBar.js'
    import {
        WAY_SIGN_EDGE,
        WAY_SIGN_HEAD,
        WAY_SIGN_REACH,
        WAY_SIGN_SHAFT_WIDTH
    } from '$lib/utils/waySign.js'
    import {
        ARROW_EDGE_WIDTH,
        ATTACK_ARROW_PATH,
        attackMarkerAngle,
        attackMarkerScale
    } from '$lib/utils/attackMarker.js'

    let { overThePieces = false }: { overThePieces?: boolean } = $props()

    const gameSession = getGameSession()

    const targets = $derived(gameSession.targets)
    const reserves = $derived(
        targets.filter(
            (target) => target.kind === TargetKind.Reserve || target.kind === TargetKind.Retreat
        )
    )
    const approaches = $derived(targets.filter((target) => target.kind === TargetKind.Approach))
    const steps = $derived(targets.filter((target) => target.kind === TargetKind.Way))
    const destination = $derived(gameSession.destination)
    const attacks = $derived(targets.filter((target) => target.kind === TargetKind.Attack))

    const arrowScale = $derived(attackMarkerScale(gameSession.zoom))

    function arrowPlacement(approach: number): string {
        const { centre } = APPROACH_GEOMETRY[approach]
        return `translate(${centre.x} ${centre.y}) scale(${arrowScale})`
    }

    function choose(event: Event, target: MoveTarget) {
        event.stopPropagation()
        gameSession.wayUnderPointer = undefined
        gameSession.chooseTarget(target)
    }

    function label(target: ReserveTarget | RetreatTarget): string {
        const place = gameSession.gameState.map.label(target.position.locale)
        if (target.kind === TargetKind.Retreat) {
            return `Retreat to ${place}`
        }
        return target.ways ? `March by road to ${place}` : `Move to ${place}`
    }

    function stepLabel({ step }: WayTarget): string {
        return step.kind === WayStepKind.Entry
            ? 'Come on by this road'
            : `March by way of ${gameSession.gameState.map.label(step.locale)}`
    }
</script>

{#snippet threatArrow(approach: number)}
    <g transform="rotate({attackMarkerAngle(APPROACH_GEOMETRY[approach])})">
        <path d={ATTACK_ARROW_PATH} stroke-width={ARROW_EDGE_WIDTH}></path>
    </g>
{/snippet}

{#snippet approachBar(approach: number, look: string)}
    {@const box = targetBarBox(approach)}
    <rect
        transform="translate({box.centre.x} {box.centre.y}) rotate({APPROACH_GEOMETRY[approach]
            .angle})"
        x={-box.halfLength}
        y={-box.halfWidth}
        width={box.halfLength * 2}
        height={box.halfWidth * 2}
        rx="3"
        class={look}
    ></rect>
{/snippet}

{#if !overThePieces}
    {#if destination?.kind === TargetKind.Reserve}
        <polygon points={localeOutlinePoints(destination.position.locale)} class="nt-target-chosen"
        ></polygon>
    {:else if destination}
        {@render approachBar(destination.position.approach, 'nt-target-chosen')}
    {/if}
    {#each steps as target (target.key)}
        {#if target.step.kind === WayStepKind.Entry}
            {@const entry = ENTRY_GEOMETRY[target.step.entryId].at}
            <circle
                cx={entry.x}
                cy={entry.y}
                r="30"
                class="nt-target-locale nt-target-way"
                class:nt-target-pointed={gameSession.wayUnderPointer === target.key}
                role="button"
                tabindex="0"
                aria-label={stepLabel(target)}
                data-entry={target.step.entryId}
                onclick={(event) => choose(event, target)}
                onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
            ></circle>
        {:else}
            <polygon
                points={localeOutlinePoints(target.step.locale)}
                class="nt-target-locale nt-target-way"
                class:nt-target-pointed={gameSession.wayUnderPointer === target.key}
                role="button"
                tabindex="0"
                aria-label={stepLabel(target)}
                data-way={target.step.locale}
                onclick={(event) => choose(event, target)}
                onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
            ></polygon>
        {/if}
    {/each}
    {#each reserves as target (target.key)}
        <polygon
            points={localeOutlinePoints(target.position.locale)}
            class="nt-target-locale"
            class:nt-target-road={markOf(target) === TargetMark.RoadMarch}
            role="button"
            tabindex="0"
            aria-label={label(target)}
            data-locale={target.position.locale}
            onclick={(event) => choose(event, target)}
            onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
        ></polygon>
    {/each}
{:else}
    {#each approaches as target (target.key)}
        <g
            role="button"
            tabindex="0"
            aria-label="Block this approach"
            data-approach={target.position.approach}
            onclick={(event) => choose(event, target)}
            onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
        >
            {@render approachBar(target.position.approach, 'nt-target-approach')}
        </g>
    {/each}
    {#each gameSession.waySigns as { target, at, arrow } (target.key)}
        {@const shaft = `M${arrow.tail.x} ${arrow.tail.y} Q${arrow.knee.x} ${arrow.knee.y} ${arrow.shaftEnd.x} ${arrow.shaftEnd.y}`}
        {@const head = `translate(${arrow.tip.x} ${arrow.tip.y}) rotate(${arrow.angle})`}
        <g
            transform="translate({at.x} {at.y}) scale({gameSession.flagView.scale})"
            class="nt-way-sign"
            role="button"
            tabindex="0"
            aria-label={stepLabel(target)}
            onpointerenter={() => (gameSession.wayUnderPointer = target.key)}
            onpointerleave={() => (gameSession.wayUnderPointer = undefined)}
            onclick={(event) => choose(event, target)}
            onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
        >
            <circle r={WAY_SIGN_REACH + WAY_SIGN_EDGE} fill="transparent"></circle>
            <path
                d={shaft}
                stroke-width={WAY_SIGN_SHAFT_WIDTH + WAY_SIGN_EDGE * 2}
                class="nt-way-sign-shaft nt-way-sign-edge"
            ></path>
            <path
                d={WAY_SIGN_HEAD}
                transform={head}
                stroke-width={WAY_SIGN_EDGE * 2}
                class="nt-way-sign-head nt-way-sign-edge"
            ></path>
            <path d={shaft} stroke-width={WAY_SIGN_SHAFT_WIDTH} class="nt-way-sign-shaft"></path>
            <path d={WAY_SIGN_HEAD} transform={head} class="nt-way-sign-head"></path>
        </g>
    {/each}
    {#if gameSession.threatBeingDeclared}
        {@const approach = gameSession.threatBeingDeclared.position.approach}
        <g
            transform={arrowPlacement(approach)}
            class="nt-target-attack nt-target-attack-chosen"
            data-threat-being-declared={approach}
        >
            {@render threatArrow(approach)}
        </g>
    {/if}
    {#each attacks as target (target.key)}
        <g
            transform={arrowPlacement(target.position.approach)}
            role="button"
            tabindex="0"
            aria-label="Threaten an attack across this approach"
            class="nt-target-attack"
            data-threat={target.position.approach}
            onclick={(event) => choose(event, target)}
            onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
        >
            <title>Threaten an attack across this approach</title>
            {@render threatArrow(target.position.approach)}
        </g>
    {/each}
{/if}

<style>
    .nt-target-locale {
        fill: var(--nt-move-fill);
        stroke: var(--nt-move-line);
        stroke-width: 3;
        stroke-dasharray: 10 7;
        cursor: pointer;
    }

    .nt-target-locale.nt-target-road {
        fill: var(--nt-road-fill);
        stroke: var(--nt-road-line);
    }

    .nt-target-locale.nt-target-way {
        fill: var(--nt-way-fill);
        stroke: var(--nt-way-line);
        stroke-width: 4;
        stroke-dasharray: none;
    }

    .nt-way-sign {
        cursor: pointer;
    }

    .nt-way-sign-shaft {
        fill: none;
        stroke: var(--nt-way-line);
        stroke-linecap: round;
    }

    .nt-way-sign-head {
        fill: var(--nt-way-line);
        stroke-linejoin: round;
    }

    .nt-way-sign-edge {
        stroke: #f9f6ee;
    }

    .nt-way-sign-head.nt-way-sign-edge {
        fill: #f9f6ee;
    }

    .nt-target-chosen {
        fill: var(--nt-road-fill);
        stroke: var(--nt-road-line);
        stroke-width: 5;
        pointer-events: none;
    }

    .nt-target-locale:hover {
        fill: rgba(246, 222, 120, 0.5);
    }

    .nt-target-locale.nt-target-way:hover,
    .nt-target-locale.nt-target-way.nt-target-pointed {
        fill: color-mix(in srgb, var(--nt-way-line) 45%, transparent);
    }

    .nt-target-approach {
        fill: var(--nt-approach-fill);
        stroke: var(--nt-move-line);
        stroke-width: 3;
        cursor: pointer;
    }

    .nt-target-approach:hover {
        fill: rgba(246, 222, 120, 0.85);
    }

    .nt-target-attack {
        cursor: pointer;
    }

    .nt-target-attack path {
        fill: #2b2620;
        stroke: #f1ecdc;
        stroke-linejoin: round;
    }

    .nt-target-attack:hover path,
    .nt-target-attack-chosen path {
        fill: #7a1418;
    }

    .nt-target-attack-chosen {
        pointer-events: none;
    }
</style>
