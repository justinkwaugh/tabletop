<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { GuildIds } from '@tabletop/feudum'
    import OpenGuild from '$lib/components/guilds/OpenGuild.svelte'
    import {
        SideButtonGap,
        SideButtonWidth,
        SideGutter,
        guildSideFollowing,
        type BoardRect,
        type FocusArea,
        type GuildSide,
        type PickFrame
    } from '$lib/model/boardFocus.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GuildAreas, GuildBox, westGuild } from '$lib/utils/boardGeometry.js'

    /**
     * Contract, Desk layout: a desk's guild areas stand behind two tall buttons at the map's sides,
     * "West guilds" and "East guilds", each the map's height at its rest. A button opens its three
     * areas upright over the map's box, under a dim scrim, as large as the box allows; the button
     * again, Escape or a press on the scrim closes it, and the other button switches. A button's dot
     * says its side holds a lit target; a pick wholly on one side opens it (Pick framing).
     */
    let {
        rest,
        lit,
        frame
    }: {
        /** The map's box at its rest, in the view's pixels. */
        rest: BoardRect
        lit: ReadonlySet<FocusArea>
        frame: PickFrame | undefined
    } = $props()

    const gameSession = getGameSession()
    const layers = gameSession.layers
    const { paintOf, colourPaintOf } = gameSession

    const Sides: readonly { readonly side: GuildSide; readonly label: string }[] = [
        { side: 'west', label: 'West guilds' },
        { side: 'east', label: 'East guilds' }
    ]
    /** Room round the open areas and between them, in pixels. */
    const Padding = 16
    const Gap = 12

    let open = $derived(layers.guildSide)
    /** Down its edge of the board, as the bench and the strip order them. */
    let guilds = $derived(
        open
            ? GuildIds.filter((guild) => westGuild(guild) === (open === 'west')).toSorted(
                  (a, b) => GuildAreas[a].y - GuildAreas[b].y
              )
            : []
    )
    /** Each area's long side: three side by side, whole inside the box. */
    let long = $derived(
        Math.max(
            0,
            Math.min(
                (((rest.width - 2 * Padding - 2 * Gap) / 3) * GuildBox.width) / GuildBox.height,
                rest.height - 2 * Padding
            )
        )
    )

    let frameKey = $derived(frame?.key)
    const followThePick: Attachment<HTMLElement> = () => {
        void frameKey
        untrack(() => layers.followGuildPick(frame?.key, guildSideFollowing(frame)))
    }

    function buttonLeft(side: GuildSide): number {
        return side === 'west' ? rest.x - SideGutter : rest.x + rest.width + SideButtonGap
    }
</script>

<div class="contents" {@attach followThePick}>
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
            {#if lit.has(side)}
                <span class="dot" data-lit-dot></span>
            {/if}
        </button>
    {/each}
    {#if open}
        <!-- Over the map's box: a press here never pans or zooms the board beneath. -->
        <div
            class="view"
            role="presentation"
            style:left="{rest.x}px"
            style:top="{rest.y}px"
            style:width="{rest.width}px"
            style:height="{rest.height}px"
            data-guild-view={open}
            onpointerdown={(event) => event.stopPropagation()}
            onwheel={(event) => event.stopPropagation()}
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
        position: absolute;
        z-index: 9;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 2px solid var(--feudum-frame);
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 0.875rem;
        font-weight: 600;
        pointer-events: auto;
    }

    .side[aria-expanded='true'] {
        border-color: var(--feudum-accent);
        background: var(--feudum-primary);
    }

    /* The West's label reads up its button, the East's down. */
    .label {
        writing-mode: vertical-rl;
        white-space: nowrap;
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
