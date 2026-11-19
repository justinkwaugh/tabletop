<script lang="ts">
    import type { MonsterId } from '@tabletop/feudum'
    import { assetUrl, monsterAsset } from '$lib/art/assetMap.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { MonsterPaths } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    /**
     * A monster. A controlled one takes its seat's colour from the session (S71): a collar on the
     * drawn form, and on either form a disc in that colour. The seat is named in its accessible name
     * and tooltip ("Ana's behemoth"), so colour never stands alone; no letter is drawn on it.
     */
    let {
        monster,
        paint,
        size = 48,
        x,
        y
    }: {
        monster: MonsterId
        paint?: SeatPaint
        size?: number
        x?: number
        y?: number
    } = $props()

    let name = $derived(monster.replace('-', ' '))
</script>

<PieceFrame
    label={paint ? `${paint.owner} ${name}` : name}
    url={assetUrl(monsterAsset(monster))}
    width={size}
    height={size}
    viewBox="0 0 48 48"
    {x}
    {y}
>
    <path
        d={MonsterPaths[monster].body}
        fill="var(--feudum-terrain-line)"
        stroke="var(--feudum-good-iron-edge)"
        stroke-width="0.75"
    ></path>
    {#if paint}
        <path
            d={MonsterPaths[monster].collar}
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="0.5"
        ></path>
    {/if}
    {#snippet over()}
        {#if paint}
            <circle cx="40" cy="40" r="7" fill={paint.fill} stroke={paint.edge}></circle>
        {/if}
    {/snippet}
</PieceFrame>
