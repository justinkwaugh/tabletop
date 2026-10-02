<script lang="ts">
    import { CardKind, PlayerStatus } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import CardWarbands from '$lib/components/CardWarbands.svelte'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import { bannerImage, favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { warbandImage } from '$lib/images/pieceImages.js'
    import {
        bannerName,
        bannerTokenKind,
        cardName,
        reliquaryLabel,
        siteName
    } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { seatAdvisers } from '$lib/model/seatAdvisers.js'
    import { handBacks } from '$lib/model/cardBacks.js'
    import { seatFacts } from '$lib/model/seatFacts.js'
    import { seatVisions } from '$lib/model/seatGoals.js'
    import { reliquarySpaces } from '$lib/model/reliquary.js'

    // Mounted beneath `CardPreviewLayer`, so a card hovered here still enlarges on top.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let seatDetail = $derived(gameSession.seatDetail)
    let playerId = $derived(seatDetail.openPlayerId)
    let isMe = $derived(gameSession.myPlayer?.id === playerId)
</script>

{#if playerId}
    {@const seat = gameState.getPlayerState(playerId)}
    {@const facts = seatFacts(gameState, playerId)}
    {@const visions = seatVisions(gameState, playerId)}
    <!-- Closed on the click, so the press that closes it reaches nothing under it (rule 7). -->
    <div
        class="seat-detail"
        role="presentation"
        onpointerdown={(event) => event.preventDefault()}
        onclick={() => seatDetail.close()}
        onkeydown={(event) => {
            if (event.key === 'Enter') seatDetail.close()
        }}
    >
        <div
            class="sheet"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label="{gameSession.getPlayerName(playerId)}'s seat"
            onpointerdown={(e) => e.stopPropagation()}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <header class="head">
                <h2>{gameSession.getPlayerName(playerId)}{isMe ? ' · you' : ''}</h2>
                <span class="status"
                    >{seat.status}{seat.siteId
                        ? ` · at ${siteName(gameState, seat.siteId)}`
                        : ''}</span
                >
                <button
                    type="button"
                    class="close"
                    onclick={() => seatDetail.close()}
                    aria-label="Close">×</button
                >
            </header>

            <dl class="counters">
                <div>
                    <img src={favorTokenImage()} alt="" />
                    <dd>{facts.favor}</dd>
                    <dt>
                        {facts.favorBank ? `favor, kept in the ${facts.favorBank} bank` : 'favor'}
                    </dt>
                </div>
                <div>
                    <img src={secretTokenImage()} alt="" />
                    <dd>
                        {seat.secrets}{#if seat.secretsFacedown}<small>
                                +{seat.secretsFacedown} facedown</small
                            >{/if}
                    </dd>
                    <dt>secrets</dt>
                </div>
                <div>
                    <dd>{seat.supply}</dd>
                    <dt>supply</dt>
                </div>
                <div>
                    <img
                        src={warbandImage(gameSession.warbandColor(facts.warbands.owner))}
                        alt=""
                    />
                    <dd>{facts.warbands.onBoard}</dd>
                    <dt>warbands, bank {facts.warbands.inBank}</dt>
                </div>
                {#if seat.handCount > 0}<div>
                        <dd>{seat.handCount}</dd>
                        <dt>in hand</dt>
                    </div>{/if}
            </dl>

            {#if visions.length > 0}
                <h3>Revealed Vision{visions.length === 1 ? '' : 's'}</h3>
                <div class="cards">
                    {#each visions as { visionId, shared } (visionId)}
                        <figure>
                            <CardImage
                                cardId={visionId}
                                width={120}
                                label={cardName(visionId)}
                                inspect
                            />
                            <figcaption>
                                <CardWarbands cardId={visionId} />
                                {shared ? 'shared' : ''}
                            </figcaption>
                        </figure>
                    {/each}
                </div>
            {/if}

            {#if seat.handCount > 0}
                <h3>Hand</h3>
                <div class="cards">
                    {#each handBacks(seat) as { back, label }, index (index)}
                        <figure>
                            <CardImage {back} width={60} {label} />
                        </figure>
                    {/each}
                </div>
            {/if}

            <h3>Advisers</h3>
            <div class="cards">
                {#each seatAdvisers(seat, gameSession.myPlayer?.id) as adviser (adviser.key)}
                    {@const cardId = adviser.cardId}
                    <figure class:own-facedown={!adviser.faceUp && (isMe || adviser.shownToMe)}>
                        {#if cardId}
                            <CardImage
                                {cardId}
                                width={120}
                                label={cardName(cardId) +
                                    (adviser.faceUp
                                        ? ''
                                        : adviser.shownToMe
                                          ? ' — facedown; shown to you'
                                          : ' — facedown; only you see it')}
                                inspect
                            />
                        {:else}
                            <CardImage back={adviser.back} width={120} label="A facedown adviser" />
                        {/if}
                        <figcaption>
                            {adviser.faceUp && cardId ? cardName(cardId) : 'facedown'}
                        </figcaption>
                    </figure>
                {:else}
                    <p class="muted">No advisers.</p>
                {/each}
            </div>

            {#if seat.relicIds.length > 0 || facts.banners.length > 0}
                <h3>Holds</h3>
                <div class="cards">
                    {#each seat.relicIds as relicId (relicId)}
                        <figure>
                            <CardImage
                                cardId={relicId}
                                width={110}
                                label={cardName(relicId)}
                                inspect
                            />
                            <figcaption>
                                {cardName(relicId)}
                                <CardWarbands cardId={relicId} />
                            </figcaption>
                        </figure>
                    {/each}
                    {#each facts.banners as banner (banner)}
                        {@const value = gameState.banners[banner].value}
                        <figure class="banner">
                            <img
                                src={bannerImage(banner, gameState.isOnMobSide(banner))}
                                alt={bannerName(banner)}
                            />
                            <figcaption>
                                <TokenBadge
                                    kind={bannerTokenKind(banner)}
                                    count={value}
                                    size={22}
                                />
                                {bannerName(banner)}
                            </figcaption>
                        </figure>
                    {/each}
                </div>
            {/if}

            {#if seat.status === PlayerStatus.Chancellor}
                <h3>Imperial Reliquary</h3>
                <div class="cards">
                    {#each reliquarySpaces(gameState) as space (space.slotId)}
                        {@const known = space.covered
                            ? gameSession.knownRelicAt(space.slotId)
                            : undefined}
                        <figure>
                            {#if !space.covered}
                                <span class="uncovered" style="width:110px;height:110px;"></span>
                                <figcaption>uncovered</figcaption>
                            {:else if known}
                                <CardImage
                                    cardId={known}
                                    width={110}
                                    label={cardName(known)}
                                    inspect
                                />
                                <figcaption>{cardName(known)}</figcaption>
                            {:else}
                                <CardImage
                                    back={CardKind.Relic}
                                    width={110}
                                    label="Facedown relic"
                                />
                                <figcaption>{reliquaryLabel(space.slotId)}</figcaption>
                            {/if}
                        </figure>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .seat-detail {
        position: fixed;
        inset: 0;
        z-index: 55;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.55);
        padding: calc(12px + env(safe-area-inset-top, 0px))
            calc(12px + env(safe-area-inset-right, 0px))
            calc(12px + env(safe-area-inset-bottom, 0px))
            calc(12px + env(safe-area-inset-left, 0px));
    }
    .sheet {
        max-width: 720px;
        max-height: calc(
            100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        );
        overflow: auto;
        overscroll-behavior: contain;
        width: 100%;
        border-radius: 12px;
        background: rgba(20, 17, 15, 0.97);
        border: 1px solid rgba(251, 191, 36, 0.45);
        color: #e7e5e4;
        padding: 12px 16px 16px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }
    .head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 8px;
    }
    .head h2 {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
    }
    .status {
        color: #a8a29e;
        font-size: 13px;
        text-transform: capitalize;
    }
    .close {
        margin-left: auto;
        font-size: 22px;
        line-height: 1;
        color: #a8a29e;
        background: none;
        border: 0;
        cursor: pointer;
        padding: 2px 8px;
    }
    .counters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin: 0 0 10px;
        font-size: 14px;
    }
    .counters div {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .counters img {
        height: 22px;
        width: auto;
    }
    .counters dd {
        margin: 0;
        font-weight: 700;
        font-size: 16px;
    }
    .counters dt {
        color: #a8a29e;
    }
    h3 {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(253, 230, 138, 0.8);
        margin: 10px 0 6px;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: flex-start;
    }
    figure {
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
    figcaption {
        font-size: 12px;
        color: #d6d3d1;
        text-align: center;
        max-width: 130px;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .own-facedown :global(img) {
        filter: brightness(0.6);
    }
    .banner img {
        width: 160px;
        height: auto;
        border-radius: 6px;
    }
    .uncovered {
        display: block;
        border-radius: 8px;
        border: 2px dashed rgba(255, 255, 255, 0.35);
    }
    .muted {
        color: #a8a29e;
        font-size: 13px;
        margin: 0;
    }
</style>
