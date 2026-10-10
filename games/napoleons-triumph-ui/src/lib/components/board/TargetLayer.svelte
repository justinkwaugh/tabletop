<script lang="ts">
    import { APPROACH_GEOMETRY, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TargetKind, type MoveTarget } from '$lib/model/targets.js'

    /** Attack markers are drawn in a pass of their own, above the pieces they would otherwise sit under. */
    let { attacks: attacksOnly = false }: { attacks?: boolean } = $props()

    const gameSession = getGameSession()

    const targets = $derived(gameSession.targets)
    const reserves = $derived(
        targets.filter((target) => target.kind === TargetKind.Reserve || target.kind === TargetKind.Retreat)
    )
    const approaches = $derived(targets.filter((target) => target.kind === TargetKind.Approach))
    const attacks = $derived(targets.filter((target) => target.kind === TargetKind.Attack))

    // Markers keep a tappable size on screen when the board is zoomed far out.
    const markerScale = $derived(Math.min(3, Math.max(1, 0.55 / gameSession.zoom)))

    function outline(locale: number): string {
        return LOCALE_GEOMETRY[locale].outline.map((point) => `${point.x},${point.y}`).join(' ')
    }

    function choose(event: Event, target: MoveTarget) {
        event.stopPropagation()
        gameSession.chooseTarget(target)
    }

    function label(target: MoveTarget): string {
        const name = gameSession.gameState.map.locale(target.position.locale).name
        const place = name ?? `locale ${target.position.locale}`
        if (target.kind === TargetKind.Retreat) {
            return `Retreat to ${place}`
        }
        return target.road ? `March by road to ${place}` : `Move to ${place}`
    }
</script>

{#if !attacksOnly}
{#each reserves as target (target.key)}
    <polygon
        points={outline(target.position.locale)}
        class="nt-target-locale"
        class:nt-target-road={target.road !== undefined}
        role="button"
        tabindex="0"
        aria-label={label(target)}
        onclick={(event) => choose(event, target)}
        onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
    />
{/each}
{#each approaches as target (target.key)}
    {@const bar = APPROACH_GEOMETRY[target.position.approach ?? 0]}
    <g
        transform="translate({bar.centre.x + bar.inward.x * 14} {bar.centre.y + bar.inward.y * 14}) rotate({bar.angle})"
        role="button"
        tabindex="0"
        aria-label="Block this approach"
        onclick={(event) => choose(event, target)}
        onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
    >
        <rect
            x={-bar.length / 2}
            y="-13"
            width={bar.length}
            height="26"
            rx="3"
            class="nt-target-approach"
        />
    </g>
{/each}
{:else}
{#each attacks as target (target.key)}
    {@const bar = APPROACH_GEOMETRY[target.position.approach ?? 0]}
    <g
        transform="translate({bar.centre.x} {bar.centre.y}) scale({markerScale})"
        role="button"
        tabindex="0"
        aria-label="Threaten an attack across this approach"
        class="nt-target-attack"
        onclick={(event) => choose(event, target)}
        onkeydown={(event) => event.key === 'Enter' && choose(event, target)}
    >
        <g transform="rotate({(Math.atan2(-bar.inward.y, -bar.inward.x) * 180) / Math.PI})">
            <path d="M-20 -11 H4 V-21 L26 0 L4 21 V11 H-20 Z" />
        </g>
    </g>
{/each}
{/if}

<style>
    .nt-target-locale {
        fill: rgba(246, 222, 120, 0.3);
        stroke: #8a6a12;
        stroke-width: 3;
        stroke-dasharray: 10 7;
        cursor: pointer;
    }

    .nt-target-locale.nt-target-road {
        fill: rgba(190, 150, 110, 0.24);
        stroke: #6d4a2a;
    }

    .nt-target-locale:hover {
        fill: rgba(246, 222, 120, 0.5);
    }

    .nt-target-approach {
        fill: rgba(246, 222, 120, 0.55);
        stroke: #8a6a12;
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
