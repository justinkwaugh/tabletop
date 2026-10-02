<script lang="ts">
    import { menuPointer } from '$lib/model/menuPointer.svelte.js'
    import { bannerName, bannerTokenKind } from '$lib/model/names.js'
    import { Banner, bannerHolder } from '@tabletop/oath'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import { bannerImage } from '$lib/images/tileImages.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-2.5 — the banners while unclaimed; a claimed banner is on its holder's
    // seat card. R-5.4.2 — a Recover lights the ones it may take, and a tap takes it.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    const BANNERS: { banner: Banner; label: string }[] = Object.values(Banner).map((banner) => ({
        banner,
        label: `the ${bannerName(banner)}`
    }))
    let unclaimed = $derived(
        BANNERS.filter(({ banner }) => bannerHolder(gameState, banner) === undefined)
    )
</script>

{#if unclaimed.length > 0}
    <section class="group">
        <h3>Unclaimed</h3>
        <div class="banners">
            {#each unclaimed as { banner, label } (banner)}
                {@const value = gameState.banners[banner].value}
                {@const amount = gameSession.bannerBid(banner)}
                {@const src = bannerImage(banner, gameState.isOnMobSide(banner))}
                <button
                    type="button"
                    class="banner"
                    class:banner--pickable={amount !== undefined}
                    class:banner--pointed={menuPointer.is({ kind: 'banner', banner })}
                    disabled={amount === undefined}
                    title={amount !== undefined
                        ? `Recover ${label} — pay ${amount} or more`
                        : `${label}, unclaimed — ${value} on it`}
                    use:inspectImage={{
                        preview: {
                            imageSrc: src,
                            aspect: 2,
                            label,
                            badge: {
                                kind: bannerTokenKind(banner),
                                count: value
                            }
                        },
                        pickable: amount !== undefined
                    }}
                    onclick={() => {
                        if (amount !== undefined) gameSession.pickBanner(banner)
                    }}
                >
                    <img {src} alt={label} />
                    <span class="banner__value">
                        <TokenBadge kind={bannerTokenKind(banner)} count={value} size={64} />
                    </span>
                    {#if amount !== undefined}<span class="banner__bid">pay {amount}+</span>{/if}
                </button>
            {/each}
        </div>
    </section>
{/if}

<style>
    .group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    h3 {
        margin: 0;
        color: var(--oath-heading);
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: uppercase;
    }
    .banners {
        display: flex;
        gap: 22px;
    }
    .banner {
        position: relative;
        width: 320px;
        height: 160px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        line-height: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
        cursor: default;
    }
    .banner img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
    }
    .banner--pickable {
        cursor: pointer;
        outline: 4px solid var(--oath-accent);
        outline-offset: 2px;
        box-shadow: 0 0 18px 4px rgba(251, 191, 36, 0.55);
    }
    .banner--pickable:hover,
    .banner--pickable.banner--pointed {
        outline-color: var(--oath-heading);
    }
    .banner__value {
        position: absolute;
        right: -20px;
        top: -20px;
        line-height: 0;
    }
    .banner__bid {
        position: absolute;
        left: 50%;
        bottom: -14px;
        transform: translateX(-50%);
        padding: 3px 12px;
        border-radius: 999px;
        background: var(--oath-accent);
        color: var(--oath-surface-raised);
        font-size: 24px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
    }
</style>
