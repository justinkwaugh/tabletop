<script lang="ts">
    import {
        TECH_FIELDS,
        TurnStep,
        techDefinition,
        type TechDefinition,
        type TechField
    } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FIELD_GLOW, TECH_EFFECT_TEXT, factionName } from '$lib/utils/presentation.js'
    import { TechStatus, techViews } from '$lib/utils/techStatus.js'
    import { treeLayout } from '$lib/utils/techTreeLayout.js'

    const STATUS_LABELS: Record<TechStatus, string> = {
        [TechStatus.Owned]: 'Developed',
        [TechStatus.Choosable]: 'Available now',
        [TechStatus.Unlocked]: 'Prerequisites met',
        [TechStatus.Locked]: 'Locked'
    }
    const BAND_LABEL_WIDTH = 64

    let { focus }: { focus?: TechField } = $props()

    const gameSession = getGameSession()
    const fields = $derived(focus ? [focus] : TECH_FIELDS)
    const layout = $derived(treeLayout(fields, focus !== undefined))
    const views = $derived(
        techViews(
            gameSession.gameState,
            gameSession.myPlayerId,
            gameSession.actingStep === TurnStep.Development
        ).filter((view) => fields.includes(view.tech.field))
    )
    const ownedIds = $derived(
        new Set(
            views.filter((view) => view.status === TechStatus.Owned).map((view) => view.tech.id)
        )
    )
    const connectors = $derived(
        views.flatMap(({ tech }) =>
            tech.prerequisites
                .map((prerequisiteId) => techDefinition(prerequisiteId))
                .filter((prerequisite) => fields.includes(prerequisite.field))
                .map((prerequisite) => ({
                    key: `${prerequisite.id}>${tech.id}`,
                    path: layout.connectorPath(prerequisite, tech),
                    color: FIELD_GLOW[prerequisite.field],
                    lit: ownedIds.has(prerequisite.id)
                }))
        )
    )

    function outsidePrerequisites(tech: TechDefinition): TechDefinition[] {
        return tech.prerequisites
            .map((prerequisiteId) => techDefinition(prerequisiteId))
            .filter((prerequisite) => !fields.includes(prerequisite.field))
    }
</script>

<div
    class="tree"
    class:focused={focus !== undefined}
    style:width="{layout.width}px"
    style:height="{layout.height}px"
    aria-label="Tech tree"
>
    <div class="title">
        <span class="title-main">Technology</span>
        <span class="legend">
            <span class="key owned">Developed</span>
            <span class="key choosable">Available now</span>
            <span class="key unlocked">Prerequisites met</span>
            <span class="key locked">Locked</span>
            <span class="note"
                >Costs include −3 for each rival who already owns a tech (minimum 5).</span
            >
        </span>
    </div>

    {#each layout.bands as band (band.field)}
        <div
            class="band"
            style:top="{band.y}px"
            style:height="{band.height}px"
            style:--field={FIELD_GLOW[band.field]}
        >
            <svg
                class="band-label"
                width={BAND_LABEL_WIDTH}
                height={band.height}
                aria-hidden="true"
            >
                <text
                    x={BAND_LABEL_WIDTH / 2}
                    y={band.height / 2}
                    transform="rotate(-90 {BAND_LABEL_WIDTH / 2} {band.height / 2})"
                    text-anchor="middle"
                    dominant-baseline="central">{band.field.toUpperCase()}</text
                >
            </svg>
        </div>
    {/each}

    <svg class="connectors" width={layout.width} height={layout.height} aria-hidden="true">
        {#each connectors as connector (connector.key)}
            <path d={connector.path} class:lit={connector.lit} style:--line={connector.color}
            ></path>
        {/each}
    </svg>

    {#each views as view (view.tech.id)}
        {@const position = layout.cardPosition(view.tech)}
        {@const selected = gameSession.selectedTech === view.tech.id}
        <button
            type="button"
            class="card {view.status.toLowerCase()}"
            class:selected
            style:left="{position.x}px"
            style:top="{position.y}px"
            style:width="{layout.cardWidth}px"
            style:height="{layout.cardHeight}px"
            style:--field={FIELD_GLOW[view.tech.field]}
            aria-label={view.tech.name}
            disabled={view.status !== TechStatus.Choosable}
            onclick={() => gameSession.selectTech(view.tech.id)}
        >
            <span class="name">{view.tech.name}</span>
            <span class="effect">{TECH_EFFECT_TEXT[view.tech.id]}</span>
            {#each outsidePrerequisites(view.tech) as prerequisite (prerequisite.id)}
                <span class="needs" style:--needs={FIELD_GLOW[prerequisite.field]}
                    >Needs {prerequisite.name}</span
                >
            {/each}
            <span class="footer">
                <span class="cost" title="{view.tech.field} points">
                    {#if view.status !== TechStatus.Owned && view.cost !== view.tech.cost}
                        <s>{view.tech.cost}</s>
                    {/if}
                    {view.status === TechStatus.Owned ? view.tech.cost : view.cost}
                </span>
                <span class="status">{STATUS_LABELS[view.status]}</span>
                <span class="owners">
                    {#each view.ownerFactions as faction (faction)}
                        <img
                            src={FACTION_ART[faction]}
                            alt={factionName(faction)}
                            title={factionName(faction)}
                        />
                    {/each}
                </span>
            </span>
        </button>
    {/each}
</div>

<style>
    .tree {
        position: relative;
        background:
            linear-gradient(rgba(127, 211, 255, 0.04) 1px, transparent 1px) 0 0 / 48px 48px,
            linear-gradient(90deg, rgba(127, 211, 255, 0.04) 1px, transparent 1px) 0 0 / 48px 48px,
            radial-gradient(ellipse at 30% 20%, #111c33 0%, #05070d 70%);
        border: 1px solid #1d2a44;
        border-radius: 18px;
        color: #dbe7f5;
        overflow: hidden;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .title {
        position: absolute;
        left: 30px;
        right: 30px;
        top: 18px;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }

    .title-main {
        font-size: 26px;
        font-weight: 300;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: #e8f4ff;
    }

    .legend {
        display: flex;
        gap: 24px;
        align-items: center;
        font-size: 19px;
        color: #8fa4c2;
    }

    .key::before {
        content: '';
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 8px;
        border-radius: 3px;
        vertical-align: -1px;
        border: 2px solid #7fd3ff;
    }

    .key.owned::before {
        background: #7fd3ff;
    }

    .key.choosable::before {
        box-shadow: 0 0 10px #7fd3ff;
    }

    .key.unlocked::before {
        border-color: #4a6a8c;
    }

    .key.locked::before {
        border-color: #26324a;
    }

    .note {
        font-style: italic;
        color: #6f84a3;
    }

    .band {
        position: absolute;
        left: 16px;
        right: 16px;
        border-radius: 14px;
        border-left: 4px solid var(--field);
        background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--field) 14%, transparent),
            color-mix(in srgb, var(--field) 2%, transparent) 40%,
            transparent
        );
    }

    .band-label {
        position: absolute;
        left: 18px;
        top: 0;
    }

    .band-label text {
        font-size: 40px;
        font-weight: 600;
        fill: var(--field);
    }

    .connectors {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .connectors path {
        fill: none;
        stroke: var(--line);
        stroke-width: 2.5px;
        stroke-opacity: 0.22;
        stroke-dasharray: 6 6;
    }

    .connectors path.lit {
        stroke-opacity: 0.85;
        stroke-dasharray: none;
        filter: drop-shadow(0 0 4px var(--line));
    }

    .card {
        position: absolute;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 14px 8px;
        text-align: left;
        background: rgba(10, 16, 30, 0.94);
        border: 1px solid color-mix(in srgb, var(--field) 35%, transparent);
        clip-path: polygon(
            0 0,
            calc(100% - 16px) 0,
            100% 16px,
            100% 100%,
            16px 100%,
            0 calc(100% - 16px)
        );
        cursor: default;
        transition:
            background 150ms ease,
            border-color 150ms ease;
    }

    .card::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 16px;
        width: 3px;
        background: var(--field);
        opacity: 0.6;
    }

    .name {
        font-size: 16px;
        font-weight: 600;
        line-height: 1.15;
        color: #f2f8ff;
    }

    .effect {
        flex: 1;
        font-size: 13px;
        line-height: 1.3;
        color: #a9bbd4;
    }

    .needs {
        font-size: 12px;
        font-weight: 600;
        color: var(--needs);
    }

    .needs::before {
        content: '↳ ';
    }

    .footer {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .cost {
        min-width: 42px;
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 700;
        text-align: center;
        color: #05070d;
        background: var(--field);
    }

    .cost s {
        font-weight: 400;
        opacity: 0.6;
        margin-right: 3px;
    }

    .status {
        flex: 1;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6f84a3;
    }

    .owners {
        display: flex;
        gap: 3px;
    }

    .owners img {
        width: 22px;
        height: 22px;
        border-radius: 4px;
    }

    .card.owned {
        background: color-mix(in srgb, var(--field) 20%, rgba(10, 16, 30, 0.96));
        border-color: var(--field);
    }

    .card.owned .status {
        color: var(--field);
    }

    .card.choosable {
        cursor: pointer;
        border: 2px solid var(--field);
        background: rgba(14, 26, 46, 0.97);
        box-shadow: inset 0 0 28px color-mix(in srgb, var(--field) 38%, transparent);
    }

    .card.choosable .status {
        color: var(--field);
        font-weight: 700;
    }

    .card.choosable::before {
        width: 5px;
        opacity: 1;
    }

    .card.choosable .name {
        color: #ffffff;
    }

    .card.choosable:hover {
        background: rgba(22, 40, 68, 0.98);
    }

    .card.unlocked {
        border-color: color-mix(in srgb, var(--field) 55%, transparent);
    }

    .card.locked .name,
    .card.locked .effect {
        opacity: 0.5;
    }

    .card.locked {
        background: rgba(8, 12, 22, 0.9);
    }

    .card.locked .cost {
        background: color-mix(in srgb, var(--field) 45%, #1a2235);
    }

    .focused .card {
        gap: 8px;
        padding: 14px 18px 12px;
    }

    .focused .name {
        font-size: 25px;
    }

    .focused .effect {
        font-size: 19px;
    }

    .focused .needs {
        font-size: 16px;
    }

    .focused .cost {
        font-size: 21px;
        min-width: 56px;
    }

    .focused .status {
        font-size: 14px;
    }

    .focused .owners img {
        width: 30px;
        height: 30px;
    }

    .card.selected {
        border: 2px solid #ffd65a;
        background: rgba(48, 40, 12, 0.96);
        box-shadow: inset 0 0 30px rgba(255, 214, 90, 0.35);
    }
</style>
