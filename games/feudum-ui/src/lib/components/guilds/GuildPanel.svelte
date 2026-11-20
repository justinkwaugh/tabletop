<script lang="ts">
    import { GuildById, type GuildId } from '@tabletop/feudum'
    import { assetUrl, guildPanelAsset } from '$lib/art/assetMap.js'
    import GuildIcon from '$lib/components/pieces/GuildIcon.svelte'
    import PieceFrame from '$lib/components/pieces/PieceFrame.svelte'
    import { CrestCentre, GuildBox, GuildViewBox } from '$lib/utils/boardGeometry.js'

    /** The printed panel when the art folder holds it, else our own plate. */
    let { guild }: { guild: GuildId } = $props()

    const CrestRadius = 30
    const CrestIcon = 36
</script>

<PieceFrame
    label="{GuildById[guild].name} guild panel"
    url={assetUrl(guildPanelAsset(guild))}
    width={GuildBox.width}
    height={GuildBox.height}
    viewBox={GuildViewBox}
>
    <rect
        x="1.5"
        y="1.5"
        width={GuildBox.width - 3}
        height={GuildBox.height - 3}
        rx="12"
        fill="var(--feudum-parchment)"
        stroke="var(--feudum-board-frame)"
        stroke-width="3"
    ></rect>
    <circle
        cx={CrestCentre.x}
        cy={CrestCentre.y}
        r={CrestRadius}
        fill="var(--feudum-wood-piece)"
        stroke="var(--feudum-wood-dark)"
        stroke-width="2"
    ></circle>
    <GuildIcon
        {guild}
        size={CrestIcon}
        x={CrestCentre.x - CrestIcon / 2}
        y={CrestCentre.y - CrestIcon / 2}
        ink="var(--feudum-ink)"
    />
    <text
        x={CrestCentre.x + CrestRadius + 12}
        y={CrestCentre.y + 10}
        font-size="30"
        fill="var(--feudum-ink)"
        style:font-family="var(--feudum-font-title)">{GuildById[guild].name}</text
    >
</PieceFrame>
