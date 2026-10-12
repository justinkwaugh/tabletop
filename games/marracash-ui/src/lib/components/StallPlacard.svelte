<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import type { ShopId } from '@tabletop/marracash'
    import AuctionPlacard from '$lib/components/AuctionPlacard.svelte'
    import { getAuctionNoticeAnimator } from '$lib/animators/auctionNoticeAnimator.svelte.js'
    import { shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'

    // `hidden` keeps the placard's place while the auction notice shows it large and flies it here.
    let { shopId, hidden }: { shopId: ShopId; hidden: boolean } = $props()

    const auctionNotice = getAuctionNoticeAnimator()
    const registerPlacard: Attachment<SVGGElement> = (element) => {
        auctionNotice.setBoardPlacard(element)
        return () => auctionNotice.setBoardPlacard(undefined)
    }

    let rect = $derived(shopRect(shopId, ShopTileInset))
</script>

<!-- The auction placard, pinned across the middle of the auctioned stall and swaying. -->
<g
    transform="translate({rect.x + rect.width / 2} {rect.y + rect.height / 2})"
    pointer-events="none"
    aria-hidden="true"
>
    <g class="placard" visibility={hidden ? 'hidden' : undefined} {@attach registerPlacard}>
        <AuctionPlacard />
    </g>
</g>

<style>
    .placard {
        transform-box: fill-box;
        transform-origin: 50% 50%;
        filter: drop-shadow(0 3px 3px rgb(0 0 0 / 0.45));
        animation: sway 3.2s ease-in-out infinite alternate;
    }

    @keyframes sway {
        from {
            transform: rotate(-5deg) scale(1);
        }
        to {
            transform: rotate(-1deg) scale(1.06);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .placard {
            animation: none;
            transform: rotate(-3deg);
        }
    }
</style>
