<script lang="ts">
    import { CardKind, PlayerStatus } from '@tabletop/oath'
    import TokenText from '$lib/components/TokenText.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { bannerImage, oathkeeperTileImage } from '$lib/images/tileImages.js'
    import { avatarImage } from '$lib/images/boardImages.js'
    import { bannerName } from '$lib/model/names.js'
    import { newsWords } from '$lib/model/sinceLastTurnWords.js'
    import type { NewsRow } from '$lib/model/sinceLastTurn.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // What changed for everyone since the seat's last turn, told once at the start of its turn.
    // R-9.4 — a Vision is shown by its back alone, to its drawer too.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.turnNotice.rows)
    let viewerId = $derived(gameSession.myPlayer?.id)
    // The words name seats by id, each drawn as its chip.
    let seats = $derived({ names: gameSession.historyNames, viewerId })

    const VISION_BACK = cardBack(CardKind.Vision)
    const PIG = cardImage('relic.oracular-pig')

    function rowKey(row: NewsRow, i: number): string {
        return row.kind === 'nextWin' ? 'nextWin' : `${row.actionId}:${row.kind}:${i}`
    }

    function avatar(playerId: string, status: PlayerStatus): string {
        return avatarImage(status, gameSession.colors.getPlayerColor(playerId))
    }

    function disc(playerId: string): string {
        const colors = gameSession.colors
        return `background:${colors.getPlayerBgColorValue(playerId)};color:${colors.getPlayerTextColorValue(playerId)}`
    }
</script>

{#snippet picture(row: NewsRow)}
    {#if row.kind === 'vision'}
        <span class="picture"
            ><img class="picture__vision" src={VISION_BACK} alt="a Vision, facedown" /></span
        >
    {:else if row.kind === 'banner'}
        <span class="picture picture--banner"
            ><img
                src={bannerImage(row.banner, row.mobSide)}
                alt="the {bannerName(row.banner)}{row.mobSide ? ', Mob side' : ''}"
            /></span
        >
    {:else if row.kind === 'title' || row.kind === 'usurper'}
        <span class="picture picture--title"
            ><img
                src={oathkeeperTileImage(row.kind === 'usurper')}
                alt={row.kind === 'usurper' ? 'the Usurper title' : 'the Oathkeeper title'}
            /></span
        >
    {:else if row.kind === 'citizen' || row.kind === 'exile'}
        <span class="picture picture--avatar"
            ><img
                src={avatar(
                    row.playerId,
                    row.kind === 'citizen' ? PlayerStatus.Citizen : PlayerStatus.Exile
                )}
                alt={row.kind === 'citizen' ? 'a Citizen' : 'an Exile'}
            /></span
        >
    {:else if row.now}
        <span class="picture" aria-hidden="true"
            ><span class="disc" style={disc(row.now.playerId)}
                >{row.now.playerId === viewerId
                    ? 'You'
                    : gameSession.getPlayerName(row.now.playerId)}</span
            ></span
        >
    {:else}
        <span class="picture" aria-hidden="true"><span class="disc disc--nobody">–</span></span>
    {/if}
{/snippet}

{#if rows.length > 0}
    <div class="since-last-turn">
        <div class="since-last-turn__card" role="dialog" aria-label="Since your last turn">
            <h3 class="since-last-turn__heading">Since your last turn</h3>
            <ul class="since-last-turn__rows">
                {#each rows as row, i (rowKey(row, i))}
                    {@const words = newsWords(row, viewerId)}
                    <li class="since-last-turn__row" data-news={row.kind}>
                        {@render picture(row)}
                        <p class="since-last-turn__text">
                            {#if words.label}<span class="since-last-turn__label"
                                    >{words.label}</span
                                >{/if}<span class="since-last-turn__line"
                                >{#each words.line as run, r (r)}{#if run.strong}<strong
                                            ><TokenText text={run.text} {seats} /></strong
                                        >{:else}<TokenText
                                            text={run.text}
                                            {seats}
                                        />{/if}{/each}</span
                            >{#if words.how || words.danger}<span class="since-last-turn__how"
                                    >{#if words.how}<TokenText
                                            text={words.how}
                                            {seats}
                                        />{/if}{#if words.how && words.danger}{' · '}{/if}{#if words.danger}<span
                                            class="since-last-turn__danger">{words.danger}</span
                                        >{/if}</span
                                >{/if}
                        </p>
                    </li>
                {/each}
            </ul>
            <button
                type="button"
                class="since-last-turn__pig"
                aria-label="The pig foresaw this: clear"
                onclick={() => gameSession.turnNotice.clear()}
            >
                <span
                    class="since-last-turn__pig-picture"
                    style:background-image={PIG && `url(${PIG})`}
                ></span>
                The pig foresaw this
            </button>
        </div>
    </div>
{/if}

<style>
    /* Over the board alone, so the turn bar and the action panel above stay clear and usable. */
    .since-last-turn {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        background: rgb(0 0 0 / 0.55);
        pointer-events: auto;
        z-index: 20;
    }
    .since-last-turn__card {
        width: min(420px, 100%);
        max-height: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px 14px;
        border-radius: 12px;
        background: var(--oath-surface-raised);
        border: 2px solid var(--oath-accent);
        box-shadow: 0 18px 50px rgb(0 0 0 / 0.7);
        color: var(--oath-text);
    }
    .since-last-turn__heading {
        flex: none;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        text-align: center;
        color: var(--oath-heading);
    }
    /* Rows past the board's height scroll inside the card; the heading and the pig stay in view. */
    .since-last-turn__rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        overflow-y: auto;
    }
    .since-last-turn__row {
        flex: none;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        background: rgb(0 0 0 / 0.25);
        border: 1px solid var(--oath-divider);
    }
    .since-last-turn__text {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        line-height: 1.35;
    }
    .since-last-turn__text strong {
        font-weight: 700;
    }
    .since-last-turn__label {
        display: block;
        margin-bottom: 1px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--oath-heading);
    }
    .since-last-turn__how {
        display: block;
        margin-top: 2px;
        font-size: 12px;
        color: var(--oath-text-muted);
    }
    .since-last-turn__danger {
        color: var(--oath-danger);
    }
    /* The row's picture: one column width, so the lines align. */
    .picture {
        flex: none;
        width: 56px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .picture img {
        display: block;
    }
    .picture__vision {
        width: 33px;
        height: 52px;
        border-radius: 3px;
        box-shadow: 0 0 0 1px var(--oath-text);
    }
    /* A banner shows its art half. */
    .picture--banner {
        width: 52px;
        margin: 0 2px;
        overflow: hidden;
        border-radius: 6px;
        box-shadow: 0 0 0 1px var(--oath-frame);
    }
    .picture--banner img {
        width: 104px;
        height: 52px;
        max-width: none;
        margin-left: -52px;
    }
    .picture--title img {
        width: 56px;
        height: 19.6px;
        border-radius: 3px;
    }
    .picture--avatar img {
        width: 46px;
        height: 46px;
        border-radius: 8px;
        border: 2px solid var(--oath-control);
        object-fit: cover;
    }
    .disc {
        width: 40px;
        height: 40px;
        overflow: hidden;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        text-transform: capitalize;
        white-space: nowrap;
        text-overflow: ellipsis;
        box-shadow:
            0 0 0 3px var(--oath-surface-raised),
            0 0 0 5px var(--oath-goal-oath);
    }
    .disc--nobody {
        color: var(--oath-text-muted);
        box-shadow:
            0 0 0 3px var(--oath-surface-raised),
            0 0 0 5px var(--oath-divider);
    }
    /* The pig in the gold outline, the card's one primary; 44 px tall at every width. */
    .since-last-turn__pig {
        flex: none;
        align-self: center;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 3px 14px 3px 3px;
        border-radius: 6px;
        background: var(--oath-primary);
        border: 1.5px solid var(--oath-primary-border);
        color: var(--oath-primary-text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
    }
    .since-last-turn__pig:hover {
        background: var(--oath-primary-hover);
    }
    .since-last-turn__pig-picture {
        flex: none;
        width: 46px;
        height: 36px;
        border-radius: 4px;
        background-position: -17px -15px;
        background-size: 78px 78px;
        background-repeat: no-repeat;
    }
    @media (max-width: 639px) {
        .since-last-turn {
            padding: 8px;
        }
        .since-last-turn__card {
            width: min(338px, 100%);
            gap: 8px;
            padding: 10px 10px 12px;
        }
        .since-last-turn__row {
            gap: 8px;
            padding: 7px;
        }
        .since-last-turn__text {
            font-size: 13.5px;
        }
        .picture {
            width: 44px;
            height: 44px;
        }
        .picture__vision {
            width: 28px;
            height: 44px;
        }
        .picture--banner {
            width: 44px;
            margin: 0;
        }
        .picture--banner img {
            width: 88px;
            height: 44px;
            margin-left: -44px;
        }
        .picture--title img {
            width: 44px;
            height: 15.4px;
        }
        .picture--avatar img {
            width: 40px;
            height: 40px;
        }
        .disc {
            width: 34px;
            height: 34px;
            font-size: 10px;
        }
    }
</style>
