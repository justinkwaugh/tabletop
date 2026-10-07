<script lang="ts">
    import { COMPANIES, CompanyKind, type CompanyId } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        COMPANY_CARD_GAP,
        COMPANY_CARD_HEIGHT,
        COMPANY_CARD_WIDTH,
        COMPANY_CARD_X,
        COMPANY_CARD_Y
    } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import Store from '../icons/Store.svelte'
    import Development from '../icons/Development.svelte'

    const gameSession = getGameSession()

    const CONTENT_X = 16
    const LOGO_WIDTH = 120
    const LOGO_HEIGHT = 76
    const SUPPLY_COLUMNS = 10

    const choosableForBuild = $derived(
        gameSession.buildCompanyOptions.length > 1 ? gameSession.buildCompanyOptions : []
    )

    const cards = $derived(
        COMPANIES.map((company, index) => {
            const state = gameSession.gameState.company(company.id)
            const shares = gameSession.gameState.sharesPerCompany()
            const buildChoice = choosableForBuild.includes(company.id)
            const auctionChoice = gameSession.auctionCompanyOptions.includes(company.id)
            return {
                company,
                state,
                style: COMPANY_STYLE[company.id],
                y: COMPANY_CARD_Y + index * (COMPANY_CARD_HEIGHT + COMPANY_CARD_GAP),
                shares,
                value: gameSession.gameState.value(company.id),
                perShare: gameSession.gameState.perShare(company.id),
                supply: gameSession.gameState.supplyRemaining(company.id),
                active: buildChoice || auctionChoice,
                buildChoice,
                selected:
                    (choosableForBuild.length > 0 && gameSession.buildCompany === company.id) ||
                    gameSession.auctionCompany === company.id ||
                    gameSession.gameState.auction?.companyId === company.id
            }
        })
    )

    function activate(companyId: CompanyId, build: boolean) {
        if (build) {
            gameSession.selectBuildCompany(companyId)
        } else {
            gameSession.selectAuctionCompany(companyId)
        }
    }

    function onKey(event: KeyboardEvent, companyId: CompanyId, build: boolean) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(companyId, build)
        }
    }

    function supplyPosition(index: number) {
        return {
            x: CONTENT_X + 112 + (index % SUPPLY_COLUMNS) * 19.5,
            y: 126 + Math.floor(index / SUPPLY_COLUMNS) * 19
        }
    }
</script>

{#snippet cardContent(card: (typeof cards)[number])}
    <rect
        width={COMPANY_CARD_WIDTH}
        height={COMPANY_CARD_HEIGHT}
        rx="10"
        class="body"
        class:selected={card.selected}
        fill={card.style.light}
        stroke={card.style.fill}
    />
    <image
        href={card.style.logo}
        x={COMPANY_CARD_WIDTH - 14 - LOGO_WIDTH}
        y="52"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
    />
    <text x={CONTENT_X} y="168" class="ability">{card.company.ability}</text>
    <text x={CONTENT_X} y="32" class="name">{card.company.name}</text>
    <text x={COMPANY_CARD_WIDTH - 14} y="19" class="treasury-label">Treasury</text>
    <text x={COMPANY_CARD_WIDTH - 14} y="43" class="treasury" fill={card.style.fill}
        >${card.state.treasury}</text
    >
    <text x={CONTENT_X} y="58" class="stat"
        >Value <tspan class="figure">${card.value}</tspan></text
    >
    <text x={CONTENT_X + 116} y="58" class="stat"
        >Per share <tspan class="figure">${card.perShare}</tspan></text
    >
    {#each Array.from({ length: card.shares }, (_, index) => index) as share (share)}
        {@const owner = card.state.owners[share]}
        <g transform="translate({CONTENT_X + share * 50} 70)">
            {#if owner}
                <rect
                    width="44"
                    height="32"
                    rx="3"
                    class="certificate"
                    fill={gameSession.colors.getPlayerUiColor(owner)}
                />
                <rect
                    x="3"
                    y="3"
                    width="38"
                    height="26"
                    rx="2"
                    class="certificate-border"
                    stroke={gameSession.colors.getPlayerTextColorValue(owner)}
                />
                <text
                    x="22"
                    y="22.5"
                    class="certificate-initial"
                    fill={gameSession.colors.getPlayerTextColorValue(owner)}
                    >{gameSession.getPlayerName(owner).charAt(0).toUpperCase()}</text
                >
            {:else}
                <rect width="44" height="32" rx="3" class="share" stroke={card.style.fill} />
                <text x="22" y="21" class="share-label">share</text>
            {/if}
        </g>
    {/each}
    <text x={CONTENT_X} y="131" class="supply-label"
        >{card.company.kind === CompanyKind.Grocer ? 'Stores' : 'Developments'}</text
    >
    {#each Array.from({ length: card.supply }, (_, index) => index) as item (item)}
        {@const at = supplyPosition(item)}
        {#if card.company.kind === CompanyKind.Grocer}
            <Store x={at.x} y={at.y} size={14} fill={card.style.fill} tint={card.style.tint} />
        {:else}
            <Development x={at.x} y={at.y} size={16} />
        {/if}
    {/each}
    {#if card.supply === 0}
        <text x={CONTENT_X + 104} y="131" class="empty">none left</text>
    {/if}
{/snippet}

{#each cards as card (card.company.id)}
    {#if card.active}
        <g
            transform="translate({COMPANY_CARD_X} {card.y})"
            class="card active"
            role="button"
            tabindex="0"
            aria-label={card.buildChoice
                ? `Build for ${card.company.name}`
                : `Auction a ${card.company.name} share`}
            onclick={() => activate(card.company.id, card.buildChoice)}
            onkeydown={(event) => onKey(event, card.company.id, card.buildChoice)}
        >
            {@render cardContent(card)}
        </g>
    {:else}
        <g transform="translate({COMPANY_CARD_X} {card.y})" class="card">
            {@render cardContent(card)}
        </g>
    {/if}
{/each}

<style>
    .body {
        stroke-width: 3;
    }

    .body.selected {
        stroke: #c8961a;
        stroke-width: 5;
    }

    .active {
        cursor: pointer;
        outline: none;
    }

    .active .body {
        stroke: #c8961a;
        stroke-width: 5;
        stroke-dasharray: 10 5;
    }

    .active:hover .body,
    .active:focus-visible .body {
        fill: #fff3c4;
    }


    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 19px;
        font-weight: 700;
        fill: #2b1a10;
    }

    .treasury-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-style: italic;
        fill: #6b4a28;
        text-anchor: end;
    }

    .treasury {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        text-anchor: end;
    }

    .stat {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        fill: #6b4a28;
    }

    .supply-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        fill: #6b4a28;
    }

    .figure {
        font-size: 18px;
        font-weight: 700;
        fill: #2b1a10;
    }

    .ability {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-style: italic;
        fill: #5a3a28;
    }

    .share {
        fill: rgba(255, 255, 255, 0.5);
        stroke-width: 1.5;
        stroke-dasharray: 3 2;
    }

    .certificate {
        stroke: #1d140b;
        stroke-width: 1.4;
    }

    .certificate-border {
        fill: none;
        stroke-width: 1;
        opacity: 0.55;
    }

    .certificate-initial {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        text-anchor: middle;
    }

    .share-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        fill: #9a8a74;
        text-anchor: middle;
    }


    .empty {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-style: italic;
        fill: #9a6a45;
    }
</style>
