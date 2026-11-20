<script lang="ts">
    import type { GuildId, LocationKind } from '@tabletop/feudum'
    import { assetUrl, locationAsset } from '$lib/art/assetMap.js'
    import { GuildIconPaths, KeepPath, LocationPaths } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    /** Told by its silhouette as well as its colour, a feudum by its guild's icon. */
    let {
        kind,
        guild,
        start = false,
        size = 48,
        x,
        y
    }: {
        kind: LocationKind
        guild?: GuildId
        start?: boolean
        size?: number
        x?: number
        y?: number
    } = $props()

    let label = $derived(kind === 'feudum' && guild ? `${guild} feudum` : kind)
    let url = $derived(
        kind === 'feudum' && !guild ? undefined : assetUrl(locationAsset(kind, guild))
    )
</script>

<PieceFrame
    {label}
    {url}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    artBox={{ x: 8, y: 8, width: 84, height: 84 }}
    {x}
    {y}
>
    <circle
        cx="50"
        cy="50"
        r="42"
        fill="var(--feudum-disc-{kind})"
        stroke="var(--feudum-map-ink)"
        stroke-width="2"
    ></circle>
    {#if kind === 'feudum'}
        <path d={KeepPath} transform="translate(12 8) scale(0.76)" fill="var(--feudum-terrain-line)"
        ></path>
        {#if guild}
            <circle cx="50" cy="60" r="15" fill="var(--feudum-parchment)"></circle>
            <path
                d={GuildIconPaths[guild]}
                transform="translate(38 48)"
                fill="var(--feudum-ink)"
                fill-rule="evenodd"
            ></path>
        {/if}
    {:else}
        <path
            d={LocationPaths[kind]}
            transform="translate(20 20) scale(2.5)"
            fill="var(--feudum-terrain-line)"
        ></path>
    {/if}
    {#snippet over()}
        {#if start}
            <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--feudum-map-ink)"
                stroke-width="2"
            ></circle>
            <circle
                cx="50"
                cy="50"
                r="49"
                fill="none"
                stroke="var(--feudum-map-ink)"
                stroke-width="2"
            ></circle>
        {/if}
    {/snippet}
</PieceFrame>
