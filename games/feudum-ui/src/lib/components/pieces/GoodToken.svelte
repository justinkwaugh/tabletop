<script lang="ts">
    import type { Good } from '@tabletop/feudum'
    import { assetUrl, goodAsset } from '$lib/art/assetMap.js'
    import { GoodPaths } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    /** A good: its own silhouette as well as its colour, so none is told by colour alone. */
    let { good, size = 24, x, y }: { good: Good; size?: number; x?: number; y?: number } = $props()
</script>

<PieceFrame
    label={good}
    url={assetUrl(goodAsset(good))}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {x}
    {y}
>
    <path
        d={GoodPaths[good]}
        fill="var(--feudum-good-{good})"
        stroke={good === 'iron' ? 'var(--feudum-good-iron-edge)' : 'var(--feudum-map-ink)'}
        stroke-width="1"
    ></path>
</PieceFrame>
