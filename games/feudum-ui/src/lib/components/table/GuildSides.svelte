<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import OpenGuild from '$lib/components/guilds/OpenGuild.svelte'
    import {
        SideButtonGap,
        SideButtonWidth,
        SideGutter,
        type FocusArea,
        type GuildSide
    } from '$lib/model/boardFocus.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GuildBox, guildsDownSide } from '$lib/utils/boardGeometry.js'
    import GuildFaces from './GuildFaces.svelte'

    /** Contract, Desk layout: a desk's guild areas stand behind two buttons at the map's sides. */
    let {
        rest,
        lit
    }: {
        rest: BoundingBox
        lit: ReadonlySet<FocusArea>
    } = $props()

    const gameSession = getGameSession()
    const layers = gameSession.layers
    const { paintOf, colourPaintOf } = gameSession

    const Sides: readonly { readonly side: GuildSide; readonly label: string }[] = [
        { side: 'west', label: 'West guilds' },
        { side: 'east', label: 'East guilds' }
    ]
    const Padding = 16
    const Gap = 12

    let open = $derived(layers.guildSide)
    let guilds = $derived(open ? guildsDownSide(open === 'west') : [])
    let long = $derived(
        Math.max(
            0,
            Math.min(
                (((rest.width - 2 * Padding - 2 * Gap) / 3) * GuildBox.width) / GuildBox.height,
                rest.height - 2 * Padding
            )
        )
    )

    /** One root listener: WebKit restyles the page whenever a wheel listener comes or goes. */
    function keepWheelInView(event: WheelEvent) {
        if (event.target instanceof Element && event.target.closest('[data-guild-view]')) {
            event.stopPropagation()
        }
    }

    function buttonLeft(side: GuildSide): number {
        return side === 'west' ? rest.x - SideGutter : rest.x + rest.width + SideButtonGap
    }
</script>

<div class="contents" onwheel={keepWheelInView}>
    {#each Sides as { side, label } (side)}
        <button
            type="button"
            class="side {side}"
            style:left="{buttonLeft(side)}px"
            style:top="{rest.y}px"
            style:width="{SideButtonWidth}px"
            style:height="{rest.height}px"
            aria-expanded={open === side}
            aria-controls="feudum-guilds-{side}"
            data-guild-side={side}
            onclick={() => layers.toggleGuildSide(side)}
        >
            <span class="label" data-side-label>{label}</span>
            <GuildFaces {side} />
            {#if lit.has(side)}
                <span class="dot" data-lit-dot></span>
            {/if}
        </button>
    {/each}
    {#if open}
        <div
            class="view"
            role="presentation"
            style:left="{rest.x}px"
            style:top="{rest.y}px"
            style:width="{rest.width}px"
            style:height="{rest.height}px"
            data-guild-view={open}
            onpointerdown={(event) => event.stopPropagation()}
        >
            <div
                class="scrim"
                role="presentation"
                onclick={() => layers.closeGuildSide()}
                data-guild-scrim
            ></div>
            <div
                class="row"
                id="feudum-guilds-{open}"
                role="group"
                aria-label={open === 'west' ? 'West guilds' : 'East guilds'}
                style:gap="{Gap}px"
            >
                {#each guilds as guild (guild)}
                    <OpenGuild
                        {guild}
                        {long}
                        state={gameSession.gameState}
                        {paintOf}
                        {colourPaintOf}
                        chrome={gameSession.boardChrome}
                    />
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .side {
        --wood: linear-gradient(
            90deg,
            var(--feudum-wood-dark),
            var(--feudum-wood-piece) 50%,
            var(--feudum-wood-dark)
        );
        position: absolute;
        z-index: 9;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 0;
        border: 2px solid var(--feudum-gilt);
        border-radius: 10px;
        background: var(--wood);
        box-shadow:
            inset 0 0 0 2px var(--feudum-wood-dark),
            0 3px 10px color-mix(in srgb, var(--feudum-halo) 50%, transparent);
        pointer-events: auto;
    }

    .side:hover {
        background:
            linear-gradient(color-mix(in srgb, var(--feudum-parchment) 12%, transparent)),
            var(--wood);
    }

    .side[aria-expanded='true'] {
        border-color: var(--feudum-accent);
        box-shadow:
            inset 0 0 0 2px var(--feudum-wood-dark),
            0 0 0 2px var(--feudum-accent),
            0 0 14px color-mix(in srgb, var(--feudum-accent) 60%, transparent);
    }

    .side:focus-visible {
        outline: 2px solid var(--feudum-accent);
        outline-offset: 3px;
    }

    .label {
        writing-mode: vertical-rl;
        white-space: nowrap;
        font-family: var(--feudum-font-title);
        font-size: 15px;
        letter-spacing: 0.06em;
        color: var(--feudum-parchment);
        text-shadow: 0 1px 2px var(--feudum-halo);
    }

    .west .label {
        transform: rotate(180deg);
    }

    .dot {
        position: absolute;
        top: 4px;
        left: 50%;
        width: 8px;
        height: 8px;
        margin-left: -4px;
        border-radius: 50%;
        background: var(--feudum-accent);
        box-shadow: 0 0 4px var(--feudum-accent);
    }

    .view {
        position: absolute;
        z-index: 9;
        overflow: hidden;
        cursor: default;
    }

    .scrim {
        position: absolute;
        inset: 0;
        background: var(--feudum-dim);
    }

    .row {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
</style>
