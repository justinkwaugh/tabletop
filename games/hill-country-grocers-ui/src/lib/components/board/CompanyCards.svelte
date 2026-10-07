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
    const LOGO_WIDTH = 100
    const LOGO_HEIGHT = 64
    const SUPPLY_COLUMNS = 10
    const SHARE_STEP = 44
    const TIP_WIDTH = 372

    let tipCompanyId = $state<CompanyId>()

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
                breakdown: valueLines(company.id),
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

    function count(amount: number, singular: string, plural: string = `${singular}s`): string {
        return `${amount} ${amount === 1 ? singular : plural}`
    }

    function valueLines(companyId: CompanyId): string[] {
        const parts = gameSession.gameState.valueBreakdown(companyId)
        const held = gameSession.gameState.company(companyId).owners.length
        const developments = `${count(parts.developments, 'development')} × $${parts.developmentValue}`
        const value =
            parts.cityValue > 0
                ? `Value: ${count(parts.cities, 'city', 'cities')} × $${parts.cityValue} + ${developments} = $${parts.total}`
                : `Value: ${developments} = $${parts.total}`
        const perShare =
            held === 0
                ? 'Per share: no shares held by players yet'
                : `Per share: $${parts.total} ÷ ${count(held, 'share')} held = $${gameSession.gameState.perShare(companyId)} (rounded up)`
        return [value, perShare]
    }

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
            x: CONTENT_X + 120 + (index % SUPPLY_COLUMNS) * 17.5,
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
        y="56"
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
    <g
        class="value"
        role="button"
        tabindex="0"
        aria-label="Value ${card.value}. {card.breakdown.join(' ')}"
        onmouseenter={() => (tipCompanyId = card.company.id)}
        onmouseleave={() => (tipCompanyId = undefined)}
        onfocus={() => (tipCompanyId = card.company.id)}
        onblur={() => (tipCompanyId = undefined)}
    >
        <rect x={CONTENT_X - 4} y="40" width="96" height="26" class="value-hit" />
        <text x={CONTENT_X} y="58" class="stat"
            >Value <tspan class="figure">${card.value}</tspan> <tspan class="info">ⓘ</tspan></text
        >
    </g>
    <text x={CONTENT_X + 108} y="58" class="stat"
        >Per share <tspan class="figure">${card.perShare}</tspan></text
    >
    {#each Array.from({ length: card.shares }, (_, index) => index) as share (share)}
        {@const owner = card.state.owners[share]}
        <g transform="translate({CONTENT_X + share * SHARE_STEP} 70)">
            {#if owner}
                <rect
                    width="40"
                    height="30"
                    rx="3"
                    class="certificate"
                    fill={gameSession.colors.getPlayerUiColor(owner)}
                />
                <rect
                    x="3"
                    y="3"
                    width="34"
                    height="24"
                    rx="2"
                    class="certificate-border"
                    stroke={gameSession.colors.getPlayerTextColorValue(owner)}
                />
                <text
                    x="20"
                    y="21"
                    class="certificate-initial"
                    fill={gameSession.colors.getPlayerTextColorValue(owner)}
                    >{gameSession.getPlayerName(owner).charAt(0).toUpperCase()}</text
                >
            {:else}
                <rect width="40" height="30" rx="3" class="share" stroke={card.style.fill} />
                <text x="20" y="19" class="share-label">share</text>
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
        <text x={CONTENT_X + 112} y="131" class="empty">none left</text>
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

{#each cards as card (card.company.id)}
    {#if tipCompanyId === card.company.id}
        <g transform="translate({COMPANY_CARD_X + 8} {card.y + 70})" class="tip" aria-hidden="true">
            <rect width={TIP_WIDTH} height="54" rx="7" class="tip-box" />
            {#each card.breakdown as line, index (line)}
                <text x="12" y={22 + index * 20} class="tip-line">{line}</text>
            {/each}
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

    .value {
        cursor: help;
        outline: none;
    }

    .value-hit {
        fill: transparent;
    }

    .value:focus-visible .value-hit {
        stroke: #c8961a;
        stroke-width: 2;
        rx: 4;
    }

    .info {
        font-size: 12px;
        fill: #8a6a45;
    }

    .tip {
        pointer-events: none;
    }

    .tip-box {
        fill: #2b1a10;
        opacity: 0.94;
    }

    .tip-line {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        fill: #fdf3dc;
    }

    .figure {
        font-size: 18px;
        font-weight: 700;
        fill: #2b1a10;
    }

    .ability {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
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
