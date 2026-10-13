<script lang="ts">
    import { APPROACH_GEOMETRY, ENTRY_GEOMETRY, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
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
    import {
        ATTACK_ARROW_PATH,
        attackMarkerAngle,
        attackMarkerScale
    } from '$lib/utils/attackMarker.js'

    let { attacks: attacksOnly = false }: { attacks?: boolean } = $props()

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

    function outline(locale: number): string {
        return LOCALE_GEOMETRY[locale].outline.map((point) => `${point.x},${point.y}`).join(' ')
    }

    function choose(event: Event, target: MoveTarget) {
        event.stopPropagation()
        gameSession.chooseTarget(target)
    }

    // Threat arrows are drawn over the pieces they belong to, so the session decides from where the tap fell whether it was meant for a block under the arrow.
    function threaten(event: MouseEvent & { currentTarget: SVGGElement }, target: AttackTarget) {
        event.stopPropagation()
        const board = event.currentTarget.ownerSVGElement
        const toBoard = board?.getScreenCTM()?.inverse()
        if (toBoard) {
            const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(toBoard)
            gameSession.tapThreatArrow(target, { x: at.x, y: at.y })
        }
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

{#snippet approachBar(approach: number, look: string)}
    {@const bar = APPROACH_GEOMETRY[approach]}
    <rect
        transform="translate({bar.centre.x + bar.inward.x * 14} {bar.centre.y +
            bar.inward.y * 14}) rotate({bar.angle})"
        x={-bar.length / 2}
        y="-13"
        width={bar.length}
        height="26"
        rx="3"
        class={look}
    ></rect>
{/snippet}

{#if !attacksOnly}
    {#if destination?.kind === TargetKind.Reserve}
        <polygon points={outline(destination.position.locale)} class="nt-target-chosen"></polygon>
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
                class="nt-target-locale nt-target-road"
                role="button"
                tabindex="0"
                aria-label={stepLabel(target)}
                data-entry={target.step.entryId}
                onclick={(event) => choose(event, target)}
                onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
            ></circle>
        {:else}
            <polygon
                points={outline(target.step.locale)}
                class="nt-target-locale nt-target-road"
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
            points={outline(target.position.locale)}
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
{:else}
    {#each attacks as target (target.key)}
        {@const bar = APPROACH_GEOMETRY[target.position.approach]}
        <g
            transform="translate({bar.centre.x} {bar.centre.y}) scale({arrowScale})"
            role="button"
            tabindex="0"
            aria-label="Threaten an attack across this approach"
            class="nt-target-attack"
            onclick={(event) => threaten(event, target)}
            onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
        >
            <title>Threaten an attack across this approach</title>
            <g transform="rotate({attackMarkerAngle(bar)})">
                <path d={ATTACK_ARROW_PATH}></path>
            </g>
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

    .nt-target-chosen {
        fill: var(--nt-road-fill);
        stroke: var(--nt-road-line);
        stroke-width: 5;
        pointer-events: none;
    }

    .nt-target-locale:hover {
        fill: rgba(246, 222, 120, 0.5);
    }

    .nt-target-approach {
        fill: var(--nt-approach-fill);
        stroke: var(--nt-move-line);
        stroke-width: 2;
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
        stroke-width: 2.5;
        stroke-linejoin: round;
    }

    .nt-target-attack:hover path {
        fill: #7a1418;
    }
</style>
