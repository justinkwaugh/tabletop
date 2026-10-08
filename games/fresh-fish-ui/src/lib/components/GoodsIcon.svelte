<svelte:options namespace="svg" />

<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'

    let { goodsType, color }: { goodsType?: GoodsType; color: string } = $props()
</script>

<g fill={color} stroke="none">
    {#if goodsType === GoodsType.Fish}
        <path d="M1.5 10 Q7.5 3.2 14.5 10 Q7.5 16.8 1.5 10 Z"></path>
        <path d="M13.6 10 L19 5.6 L18 10 L19 14.4 Z"></path>
        <circle cx="5.4" cy="9.1" r="1" fill="#000" opacity="0.45"></circle>
    {:else if goodsType === GoodsType.Cheese}
        <path d="M1.5 15.5 L18.5 15.5 L18.5 8.5 Z"></path>
        <path d="M1.5 15.5 L18.5 8.5 L14.5 5.5 Z" opacity="0.75"></path>
        <circle cx="12.5" cy="13.4" r="1.3" fill="#000" opacity="0.3"></circle>
        <circle cx="16" cy="11.6" r="0.9" fill="#000" opacity="0.3"></circle>
        <circle cx="8.6" cy="14.6" r="0.7" fill="#000" opacity="0.3"></circle>
    {:else if goodsType === GoodsType.IceCream}
        <path d="M5.6 9.6 L14.4 9.6 L10 19 Z" opacity="0.8"></path>
        <circle cx="10" cy="7" r="4.8"></circle>
        <circle cx="7" cy="9.2" r="1.6"></circle>
        <circle cx="13" cy="9.2" r="1.6"></circle>
    {:else if goodsType === GoodsType.Lemonade}
        <path d="M5 7.4 L15 7.4 L13.6 18.5 L6.4 18.5 Z"></path>
        <rect x="4.2" y="5.4" width="11.6" height="2.4" rx="0.8"></rect>
        <path d="M10.8 5.6 L13.2 1.2" stroke={color} stroke-width="1.4" stroke-linecap="round"
        ></path>
    {/if}
</g>
