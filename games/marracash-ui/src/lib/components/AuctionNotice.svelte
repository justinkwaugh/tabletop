<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { PlayerName } from '@tabletop/frontend-components'
    import AuctionPlacard from '$lib/components/AuctionPlacard.svelte'
    import type {
        AuctionNoticeAnimator,
        AuctionNoticePart
    } from '$lib/animators/auctionNoticeAnimator.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { animator }: { animator: AuctionNoticeAnimator } = $props()
    const gameSession = getGameSession()

    let notice = $derived(animator.shown)
    let palette = $derived(notice ? gameSession.marketPalettes[notice.color] : undefined)

    const part =
        (name: AuctionNoticePart): Attachment<HTMLElement> =>
        (element) => {
            animator.setPart(name, element)
            return () => animator.setPart(name, undefined)
        }
</script>

{#if notice}
    <!-- Shown only while its auction's animation plays; it takes no input. -->
    <div class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
        <div class="backdrop absolute inset-0" {@attach part('backdrop')}></div>
        <div class="relative flex flex-col items-center gap-4">
            <div class="placard" aria-hidden="true" {@attach part('placard')}>
                <svg viewBox="-54 -18 108 36" width="324" height="108">
                    <AuctionPlacard />
                </svg>
            </div>
            <p class="card marracash-display" role="status" {@attach part('card')}>
                <PlayerName playerId={notice.auctioneerId} /> is auctioning a
                <span class="market">
                    <span
                        class="swatch"
                        style:background={palette?.fill}
                        style:border-color={palette?.stroke}
                    ></span>
                    {notice.color} shop
                </span>
            </p>
        </div>
    </div>
{/if}

<style>
    .backdrop {
        background: rgb(13 17 40 / 0.55);
        backdrop-filter: blur(1.5px);
    }

    .placard {
        filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.5));
    }

    .card {
        max-width: 420px;
        padding: 14px 22px;
        border-radius: 10px;
        font-size: 20px;
        line-height: 1.35;
        text-align: center;
        color: var(--door-ink);
        background: linear-gradient(180deg, var(--parchment), var(--cream));
        box-shadow:
            inset 0 0 0 2px var(--trim),
            0 10px 24px -8px rgb(0 0 0 / 0.6);
    }

    .market {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }

    .swatch {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 1.5px solid;
        border-radius: 50%;
    }
</style>
