<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-9.4 — a Vision drawn is announced to every seat by its back alone; the seat clears it.
    let gameSession = getGameSession()
    let draws = $derived(gameSession.visionsSeen.draws)
    let viewerId = $derived(gameSession.myPlayer?.id)

    const VISION_BACK = cardBack(CardKind.Vision)
    const PIG = cardImage('relic.oracular-pig')
</script>

{#if draws.length > 0}
    <div class="vision-seen" role="dialog" aria-label="A Vision was seen">
        <div class="vision-seen__card">
            {#if draws.length === 1}
                <img class="vision-seen__back" src={VISION_BACK} alt="a Vision, facedown" />
                <p class="vision-seen__line">
                    <PlayerName playerId={draws[0].drawerId} />
                    {draws[0].drawerId === viewerId ? 'have' : 'has'} seen a Vision
                </p>
            {:else}
                <ul class="vision-seen__list">
                    {#each draws as draw (draw.actionId)}
                        <li class="vision-seen__line vision-seen__line--row">
                            <img
                                class="vision-seen__back vision-seen__back--small"
                                src={VISION_BACK}
                                alt="a Vision, facedown"
                            />
                            <span>
                                <PlayerName playerId={draw.drawerId} />
                                {draw.drawerId === viewerId ? 'have' : 'has'} seen a Vision
                            </span>
                        </li>
                    {/each}
                </ul>
            {/if}
            <button
                type="button"
                class="vision-seen__clear"
                aria-label="The pig foresaw this: clear"
                onclick={() => gameSession.visionsSeen.clear()}
            >
                <span class="vision-seen__pig" style:background-image={PIG && `url(${PIG})`}></span>
                The pig foresaw this
            </button>
        </div>
    </div>
{/if}

<style>
    .vision-seen {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(0 0 0 / 0.55);
        pointer-events: auto;
        z-index: 20;
    }
    .vision-seen__card {
        width: min(300px, calc(100% - 24px));
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 12px;
        background: var(--oath-vision-rust);
        border: 3px solid var(--oath-vision-gold);
        box-shadow:
            0 0 0 2px var(--oath-vision-teal),
            0 18px 50px rgb(0 0 0 / 0.7);
        color: var(--oath-vision-cream);
        text-align: center;
    }
    .vision-seen__back {
        width: 96px;
        border-radius: 6px;
        box-shadow: 0 0 0 2px var(--oath-vision-cream);
    }
    .vision-seen__back--small {
        width: 36px;
        flex: none;
    }
    .vision-seen__line {
        font-size: 17px;
        font-weight: 700;
        line-height: 1.25;
    }
    .vision-seen__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
    }
    .vision-seen__line--row {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        font-size: 15px;
    }
    .vision-seen__clear {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        padding: 4px 14px 4px 4px;
        border-radius: 8px;
        background: var(--oath-vision-cream);
        border: 2px solid var(--oath-vision-teal);
        color: var(--oath-vision-rust);
        font-weight: 800;
        font-size: 16px;
        box-shadow: 0 2px 0 rgb(0 0 0 / 0.35);
    }
    .vision-seen__clear:hover,
    .vision-seen__clear:focus-visible {
        box-shadow:
            0 0 0 3px var(--oath-vision-gold),
            0 2px 0 rgb(0 0 0 / 0.35);
    }
    .vision-seen__pig {
        width: 52px;
        height: 40px;
        border-radius: 5px;
        background-position: -19px -17px;
        background-size: 88px 88px;
        background-repeat: no-repeat;
    }
    @media (max-width: 639px) {
        .vision-seen__card {
            width: min(250px, calc(100% - 16px));
            padding: 12px;
        }
        .vision-seen__back {
            width: 80px;
        }
        .vision-seen__back--small {
            width: 36px;
        }
        .vision-seen__pig {
            width: 46px;
            height: 36px;
            background-position: -17px -15px;
            background-size: 78px 78px;
        }
    }
</style>
