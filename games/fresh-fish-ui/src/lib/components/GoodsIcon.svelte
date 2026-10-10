<svelte:options namespace="svg" />

<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'
    import { GOODS_PAINT } from '$lib/utils/pieceColors.js'

    let {
        goodsType,
        color,
        painted = false,
        outline
    }: {
        /** Traces the icon's edge in this colour, to lift it off a busy ground. */
        outline?: string
        goodsType?: GoodsType
        color: string
        /** Paints each goods in its own colours, as the printed tiles do, instead of one ink. */
        painted?: boolean
    } = $props()
</script>

{#if outline}
    <g class="icon-edge" style:--outline={outline}>
        {@render shapes()}
    </g>
{/if}
{@render shapes()}

{#snippet shapes()}
    <g fill={color} stroke="none">
        {#if goodsType === GoodsType.Fish}
            <path
                d="M1.5 10 Q7.5 3.2 14.5 10 Q7.5 16.8 1.5 10 Z"
                fill={painted ? GOODS_PAINT.fish.body : color}
            ></path>
            <path
                d="M13.6 10 L19 5.6 L18 10 L19 14.4 Z"
                fill={painted ? GOODS_PAINT.fish.tail : color}
            ></path>
            <circle cx="5.4" cy="9.1" r="1" fill="#000" opacity="0.45"></circle>
        {:else if goodsType === GoodsType.Cheese}
            <path
                d="M1.5 15.5 L18.5 15.5 L18.5 8.5 Z"
                fill={painted ? GOODS_PAINT.cheese.front : color}
            ></path>
            {#if painted}
                <path d="M1.5 15.5 L18.5 8.5 L14.5 5.5 Z" fill={GOODS_PAINT.cheese.top}></path>
            {:else}
                <path d="M1.5 15.5 L18.5 8.5 L14.5 5.5 Z" opacity="0.75"></path>
            {/if}
            <g fill={painted ? GOODS_PAINT.cheese.holes : '#000'} opacity={painted ? 1 : 0.3}>
                <circle cx="12.5" cy="13.4" r="1.3"></circle>
                <circle cx="16" cy="11.6" r="0.9"></circle>
                <circle cx="8.6" cy="14.6" r="0.7"></circle>
            </g>
        {:else if goodsType === GoodsType.IceCream}
            <g fill={painted ? GOODS_PAINT.gelato.scoop : color}>
                <circle cx="6.6" cy="9" r="3"></circle>
                <circle cx="13.4" cy="9" r="3"></circle>
                <circle cx="10" cy="7.2" r="3.4"></circle>
            </g>
            {#if painted}
                <path d="M2.6 10.6 H17.4 L15.6 16.6 H4.4 Z" fill={GOODS_PAINT.gelato.cup}></path>
                <path d="M3.1 12.2 H16.9 L16.6 13.4 H3.4 Z" fill={GOODS_PAINT.gelato.scoop}></path>
            {:else}
                <path d="M2.6 10.6 H17.4 L15.6 16.6 H4.4 Z" opacity="0.6"></path>
                <path d="M3.1 12.2 H16.9 L16.6 13.4 H3.4 Z"></path>
            {/if}
        {:else if goodsType === GoodsType.Lemonade}
            <path
                d="M5 7.4 L15 7.4 L13.6 18.5 L6.4 18.5 Z"
                fill={painted ? GOODS_PAINT.soda.cup : color}
            ></path>
            <rect
                x="4.2"
                y="5.4"
                width="11.6"
                height="2.4"
                rx="0.8"
                fill={painted ? GOODS_PAINT.soda.lid : color}
            ></rect>
            <path
                d="M10.8 5.6 L13.2 1.2"
                stroke={painted ? GOODS_PAINT.soda.straw : color}
                stroke-width="1.4"
                stroke-linecap="round"
            ></path>
        {/if}
    </g>
{/snippet}

<style>
    .icon-edge :global(path),
    .icon-edge :global(circle),
    .icon-edge :global(rect) {
        fill: var(--outline);
        stroke: var(--outline);
        stroke-width: 1.1px;
        stroke-linejoin: round;
        opacity: 1;
    }
</style>
