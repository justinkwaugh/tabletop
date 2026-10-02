<script lang="ts">
    import { range, type Player } from '@tabletop/common'
    import {
        OathProjectedPlayerState,
        PlayerStatus,
        WarbandMoveKind,
        oathTypeName
    } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import CardWarbands from '$lib/components/CardWarbands.svelte'
    import LetPeekPicker from '$lib/components/LetPeekPicker.svelte'
    import ReliquaryPlacard from '$lib/components/ReliquaryPlacard.svelte'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import { avatarImage, boardGround, titleImage } from '$lib/images/boardImages.js'
    import {
        bannerImage,
        favorTokenImage,
        goalCardImage,
        oathkeeperTileImage,
        secretTokenImage,
        SUPPLY_TRACK,
        supplyTrackImage
    } from '$lib/images/tileImages.js'
    import { warbandImage } from '$lib/images/pieceImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bannerName, bannerTokenKind, cardName, siteName } from '$lib/model/names.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { goalCardPreview } from '$lib/model/seatPreviews.js'
    import { seatAdvisers } from '$lib/model/seatAdvisers.js'
    import { handBacks } from '$lib/model/cardBacks.js'
    import { seatFacts } from '$lib/model/seatFacts.js'
    import { seatGoals, type SeatGoal } from '$lib/model/seatGoals.js'

    // R-9.4 — a facedown adviser is a back to others and a dimmed front to its owner; a hand is its backs.
    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: OathProjectedPlayerState } =
        $props()

    let gameState = $derived(gameSession.gameState)
    let isTurn = $derived(gameState.activePlayerIds.includes(player.id))
    let isMe = $derived(gameSession.myPlayer?.id === player.id)
    let status = $derived(playerState.status)
    let color = $derived(gameSession.colors.getPlayerColor(player.id))
    let seatColor = $derived(gameSession.colors.getPlayerUiColor(player.id))
    let ground = $derived(boardGround(status, color))

    let facts = $derived(seatFacts(gameState, player.id))
    let warbandFigure = $derived(warbandImage(gameSession.warbandColor(facts.warbands.owner)))

    let oathName = $derived(oathTypeName(gameState.oathType))
    let goals = $derived(seatGoals(gameState, player.id))

    function goalTitle(goal: SeatGoal): string {
        switch (goal.kind) {
            case 'successor':
                return `Successor goal for the Oath of ${oathName}`
            case 'vision':
                return goal.shared
                    ? `${cardName(goal.visionId)} — shared through a warband on it`
                    : `${cardName(goal.visionId)} — revealed`
        }
    }

    let hasHoldings = $derived(playerState.relicIds.length > 0 || facts.banners.length > 0)

    // R-6.5 — Move warbands offers its site -> board move in the panel; the counter wears the ring.
    let toBoard = $derived(
        isMe &&
            gameSession.warbandMoves.options.some(
                (option) => option.move.kind === WarbandMoveKind.SiteToBoard
            )
    )
</script>

<article
    class="seat text-left text-white"
    class:seat--turn={isTurn}
    style="--ground:{ground}; --seat:{seatColor};"
>
    <header class="strip">
        <img class="word" src={titleImage(status)} alt={status} />
        <button
            type="button"
            class="pill"
            title="Open {player.name}'s seat"
            onclick={() => gameSession.seatDetail.toggle(player.id)}
            >{player.name}{isMe ? ' · you' : ''}</button
        >
        <img class="avatar" src={avatarImage(status, color)} alt="" />
    </header>

    <dl class="stats">
        <div
            class="stat"
            title={facts.favorBank
                ? `Favor ${facts.favor}, kept in the ${facts.favorBank} bank`
                : `Favor ${playerState.favor}`}
        >
            <img src={favorTokenImage()} alt="" />
            <dd>{facts.favor}</dd>
            <dt>{facts.favorBank ? `in ${facts.favorBank}` : 'Favor'}</dt>
        </div>
        <div
            class="stat"
            title="Secrets {playerState.secrets}{playerState.secretsFacedown
                ? `, plus ${playerState.secretsFacedown} facedown`
                : ''}"
        >
            <img src={secretTokenImage()} alt="" />
            <dd>
                {playerState.secrets}{#if playerState.secretsFacedown}<small
                        >+{playerState.secretsFacedown}</small
                    >{/if}
            </dd>
            <dt>Secrets</dt>
        </div>
        <div
            class="stat stat--board"
            class:stat--pickable={toBoard}
            title={toBoard
                ? `Warbands may move from ${playerState.siteId ? siteName(gameState, playerState.siteId) : 'your site'} to your board`
                : `${facts.warbands.onBoard} warbands on the board`}
        >
            <img src={warbandFigure} alt="" />
            <dd>{facts.warbands.onBoard}</dd>
            <dt>Board</dt>
        </div>
        <div class="stat" title="{facts.warbands.inBank} warbands in the bank">
            <img src={warbandFigure} alt="" />
            <dd>{facts.warbands.inBank}</dd>
            <dt>Bank</dt>
        </div>
    </dl>

    <!-- R-2.1.5 — the board's Supply track, circles 7 down to 0 left to right;
         R-4.3.3's refresh bands are printed under it. -->
    <div
        class="track"
        title="Supply {playerState.supply} of 7. Refreshes at Rest by the warbands in the bank."
        style="--marker-x:{SUPPLY_TRACK.centers[SUPPLY_TRACK.indexOf(playerState.supply)] *
            100}%; --marker-size:{SUPPLY_TRACK.diameter * 100}%;"
    >
        <img class="track__art" src={supplyTrackImage(status)} alt="Supply track" />
        <span
            class="track__marker"
            style="--marker-color:{gameSession.colors.getUiColor(color)};"
            role="img"
            aria-label="Supply {playerState.supply}"
        ></span>
    </div>

    <div class="row">
        <div class="goal">
            {#each goals as goal (goal.key)}
                <div class="art" class:art--met={goal.met}>
                    {#if goal.kind === 'vision'}
                        <CardImage
                            cardId={goal.visionId}
                            width={100}
                            label={cardName(goal.visionId)}
                            inspect
                        />
                        <span class="on-card"><CardWarbands cardId={goal.visionId} /></span>
                        {#if goal.shared}
                            <span class="shared-tag">shared</span>
                        {/if}
                    {:else}
                        <!-- R-2.10 — one card prints the Oathkeeper goal on top and the
                             Successor goal below; a Citizen's box shows the lower half. -->
                        <img
                            class="goal__art"
                            src={goalCardImage(gameState.oathType)}
                            alt={goalTitle(goal)}
                            use:inspectImage={{
                                preview: goalCardPreview(gameState.oathType, goalTitle(goal))
                            }}
                        />
                    {/if}
                    {#if goal.met}<span class="met-tag">met</span>{/if}
                </div>
            {/each}
            {#if facts.holdsOathkeeper}
                <img
                    class="tile"
                    src={oathkeeperTileImage(facts.isUsurper)}
                    alt={facts.isUsurper ? 'Usurper' : 'Oathkeeper'}
                    title={facts.isUsurper
                        ? 'Holds the title on its Usurper side — wins at their next Wake'
                        : 'Holds the Oathkeeper title'}
                />
            {/if}
        </div>

        <div class="advisers">
            {#each seatAdvisers(playerState, gameSession.myPlayer?.id) as adviser (adviser.key)}
                {@const cardId = adviser.cardId}
                {@const playable =
                    isMe && cardId !== undefined && gameSession.selectableAdvisers.includes(cardId)}
                <figure
                    class="thumb"
                    class:thumb--own-facedown={!adviser.faceUp &&
                        (isMe || adviser.shownToMe) &&
                        !playable}
                    class:thumb--pickable={playable}
                >
                    {#if playable && cardId}
                        <!-- R-6.1 — offered in the panel; here it wears the ring and enlarges. -->
                        <CardImage {cardId} width={50} label={cardName(cardId)} inspect />
                    {:else if cardId}
                        <CardImage
                            {cardId}
                            width={50}
                            label={cardName(cardId) +
                                (adviser.faceUp
                                    ? ''
                                    : adviser.shownToMe
                                      ? ' — facedown; shown to you'
                                      : ' — facedown; only you see it')}
                            inspect
                        />
                    {:else}
                        <CardImage back={adviser.back} width={50} label="A facedown adviser" />
                    {/if}
                    <figcaption>{adviser.faceUp ? '' : 'facedown'}</figcaption>
                </figure>
            {/each}
            {#each range(0, facts.emptyAdviserSlots) as slot (slot)}
                <figure class="thumb thumb--empty">
                    <span></span>
                    <figcaption></figcaption>
                </figure>
            {/each}
        </div>
    </div>

    {#if isMe && gameSession.canLetPeek}
        <!-- R-9.4 — "at any time", so it is offered here and not only on the Act Phase grid. -->
        <div class="let-peek">
            <button
                type="button"
                class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-0.5 text-xs font-semibold"
                disabled={gameSession.busy}
                aria-expanded={gameSession.letPeekOpen}
                onclick={() => gameSession.toggleLetPeek()}
            >
                {gameSession.letPeekOpen ? 'Cancel' : 'Let another peek'}
            </button>
            {#if gameSession.letPeekOpen && !gameSession.letPeekIsStaged}
                <div class="mt-1"><LetPeekPicker /></div>
            {/if}
        </div>
    {/if}

    {#if playerState.handCount > 0}
        <div class="hand">
            <span>hand {playerState.handCount}</span>
            {#each handBacks(playerState) as { back, label }, index (index)}
                <CardImage {back} width={18} {label} />
            {/each}
        </div>
    {/if}

    {#if hasHoldings}
        <div class="row row--held">
            {#each playerState.relicIds as relicId (relicId)}
                <figure class="thumb thumb--relic">
                    <CardImage cardId={relicId} width={52} label={cardName(relicId)} inspect />
                    <span class="on-card"><CardWarbands cardId={relicId} size={12} /></span>
                </figure>
            {/each}
            {#each facts.banners as banner (banner)}
                {@const value = gameState.banners[banner].value}
                {@const bid = gameSession.bannerBid(banner)}
                <!-- R-5.4.2 — a Recover lights the banner where it is; the panel takes it. -->
                <figure
                    class="thumb thumb--banner"
                    class:thumb--pickable={bid !== undefined}
                    use:inspectImage={{
                        preview: {
                            imageSrc: bannerImage(banner, gameState.isOnMobSide(banner)),
                            aspect: 2,
                            label: `the ${bannerName(banner)}`,
                            badge: {
                                kind: bannerTokenKind(banner),
                                count: value
                            }
                        }
                    }}
                    title={bid !== undefined
                        ? `Recover the ${bannerName(banner)} — pay ${bid} or more`
                        : `Holds the ${bannerName(banner)} — ${value} on it`}
                >
                    <img
                        src={bannerImage(banner, gameState.isOnMobSide(banner))}
                        alt={`the ${bannerName(banner)}`}
                    />
                    <span class="thumb__value">
                        <TokenBadge kind={bannerTokenKind(banner)} count={value} size={24} />
                    </span>
                    {#if bid !== undefined}<figcaption class="pick-caption">
                            pay {bid}+
                        </figcaption>{/if}
                </figure>
            {/each}
        </div>
    {/if}

    {#if status === PlayerStatus.Chancellor}
        <ReliquaryPlacard />
    {/if}
    {#if gameSession.showDebug}
        <div class="text-[10px] px-2 pb-1 opacity-70">id: {player.id}</div>
    {/if}
</article>

<style>
    .seat {
        border-radius: 10px;
        background: var(--ground);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        border: 2px solid transparent;
    }
    .seat--turn {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 1);
        }
        75% {
            border-color: rgba(255, 255, 255, 1);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .seat--turn {
            animation: none;
            border-color: white;
        }
    }

    .strip {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 54px;
        padding: 0 8px 0 10px;
    }
    /* The pill ellipsises before anything overflows; the title word yields first. */
    .word {
        height: 32px;
        width: auto;
        max-width: 40%;
        min-width: 0;
        flex: 0 1 auto;
        object-fit: contain;
        object-position: left;
    }
    .pill {
        cursor: pointer;
        border: 0;
        font: inherit;
        color: inherit;
        margin-left: auto;
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: var(--seat);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-size: 11px;
        padding: 4px 8px 3px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .avatar {
        width: 42px;
        height: 42px;
        flex: none;
        border-radius: 8px;
        object-fit: cover;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        margin: 0;
        padding: 0 8px 8px;
    }
    .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 0;
        background: rgba(0, 0, 0, 0.28);
        border-radius: 7px;
        padding: 5px 2px 4px;
    }
    .stat img {
        width: 22px;
        height: 22px;
        object-fit: contain;
    }
    .stat--board {
        position: relative;
    }
    .stat--pickable {
        outline: 3px solid #fbbf24;
        outline-offset: 1px;
        box-shadow: 0 0 10px 2px rgba(251, 191, 36, 0.6);
    }
    .stat--pickable:hover {
        outline-color: #fde68a;
    }
    .stat dd {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }
    .stat dd small {
        font-size: 10px;
        font-weight: 500;
        opacity: 0.8;
    }
    .stat dt {
        font-size: 8px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.8;
        white-space: nowrap;
    }

    .track {
        position: relative;
        margin: 0 8px 8px;
        line-height: 0;
    }
    .track__art {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 4px;
    }
    .track__marker {
        position: absolute;
        left: var(--marker-x);
        top: 50%;
        width: var(--marker-size);
        aspect-ratio: 1;
        border-radius: 50%;
        background: var(--marker-color);
        border: 2px solid rgba(255, 255, 255, 0.85);
        box-sizing: border-box;
        transform: translate(-50%, -50%) scale(0.86);
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }

    .row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 8px 6px;
        background: rgba(0, 0, 0, 0.22);
    }
    .row--held {
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        gap: 6px;
    }
    .seat > .row:last-child {
        border-radius: 0 0 8px 8px;
    }

    .goal {
        flex: none;
        width: 100px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .art {
        position: relative;
        border-radius: 4px;
    }
    .art--met {
        outline: 3px solid #fbbf24;
        outline-offset: -1px;
        box-shadow:
            0 0 0 1px #1c1917,
            0 0 10px rgba(251, 191, 36, 0.6);
    }
    .met-tag {
        position: absolute;
        right: -4px;
        top: -7px;
        z-index: 2;
        background: #fbbf24;
        color: #1c1917;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 999px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        pointer-events: none;
    }
    .on-card {
        position: absolute;
        left: 2px;
        bottom: 2px;
        z-index: 2;
        pointer-events: none;
    }
    .shared-tag {
        position: absolute;
        left: -4px;
        top: -7px;
        z-index: 2;
        background: #a8a29e;
        color: #1c1917;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 999px;
        pointer-events: none;
    }
    .thumb--relic {
        position: relative;
    }
    .goal__art {
        display: block;
        width: 100px;
        height: 59px;
        object-fit: cover;
        object-position: bottom;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .tile {
        display: block;
        width: 100px;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }

    .advisers {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        min-width: 0;
    }
    .thumb {
        margin: 0;
        flex: none;
    }
    .thumb figcaption {
        height: 12px;
        margin-top: 3px;
        font-size: 8px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        text-align: center;
        color: #fde68a;
    }
    .let-peek {
        padding: 0 8px 6px;
    }

    .thumb--own-facedown :global(img) {
        filter: saturate(0.55) brightness(0.8);
    }
    .thumb--own-facedown:hover :global(img) {
        filter: none;
    }
    .thumb--empty span {
        display: block;
        width: 50px;
        height: 78px;
        border: 1.5px dashed rgba(255, 255, 255, 0.35);
        border-radius: 4px;
    }
    .thumb--banner {
        position: relative;
    }
    .thumb--banner img {
        display: block;
        width: 104px;
        height: 52px;
        object-fit: cover;
        border-radius: 4px;
    }

    .thumb__value {
        position: absolute;
        right: -8px;
        top: -8px;
        line-height: 0;
    }

    .thumb--pickable {
        outline: 3px solid #fbbf24;
        outline-offset: 2px;
        border-radius: 4px;
        box-shadow: 0 0 10px 2px rgba(251, 191, 36, 0.6);
    }
    .pick-caption {
        margin-top: 3px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        text-align: center;
        color: #fbbf24;
    }
    .hand span {
        margin-right: 4px;
    }
    .hand {
        display: flex;
        align-items: center;
        gap: 3px;
        margin: 0;
        padding: 2px 10px 4px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
        background: rgba(0, 0, 0, 0.22);
    }
</style>
