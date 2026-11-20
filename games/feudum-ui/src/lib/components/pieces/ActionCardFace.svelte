<script lang="ts">
    import { ActionCards, type ActionCardKind } from '@tabletop/feudum'
    import { assetUrl, cardAsset, cardBackAsset } from '$lib/art/assetMap.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        CardArt,
        CardBox,
        faceTier,
        PrintArtWindow,
        PrintBand,
        PrintedArtAt,
        PrintedArtFile,
        PrintedArtScale,
        PrintedCard,
        PrintedCardCorner,
        PrintedCardPlace,
        PrintFrame,
        printFrameRect,
        printRosettes,
        shortName,
        wrapLines
    } from '$lib/utils/cardShape.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import CardSymbolRow from './CardSymbolRow.svelte'
    import GoodToken from './GoodToken.svelte'
    import GuildIcon from './GuildIcon.svelte'
    import ShillingToken from './ShillingToken.svelte'

    /** R-3.1 A back draws from the seat alone, so nothing of the card reaches the markup. */
    let {
        faceShown,
        kind,
        paint,
        number,
        width,
        x,
        y
    }: {
        faceShown: boolean
        kind?: ActionCardKind
        paint: SeatPaint
        number?: number
        width: number
        x?: number
        y?: number
    } = $props()

    let tier = $derived(faceTier(width))
    let height = $derived((width * CardBox.height) / CardBox.width)
    let viewBox = `0 0 ${CardBox.width} ${CardBox.height}`
    let card = $derived(faceShown ? ActionCards.find((one) => one.kind === kind) : undefined)
    let label = $derived(
        card ? `${paint.owner} ${card.printedName} card` : `${paint.owner} card back`
    )
    let url = $derived(card ? assetUrl(cardAsset(card.kind)) : undefined)
    let printedBackUrl = $derived(
        !card && paint.printed ? assetUrl(cardBackAsset(paint.printed)) : undefined
    )
    /** The print's foot names nothing: the card is named once, in the art's title. */
    let printedFace = $derived(
        card && paint.printed && url
            ? { band: PrintBand[paint.printed], at: PrintedArtAt[card.kind], url }
            : undefined
    )
    const uid = $props.id()
    const artClip = `${uid}-art`
    const bars = printFrameRect(PrintFrame.bar / 2)
    const lightBar = printFrameRect(PrintFrame.bar / 2 - 1)
    const rosettes = printRosettes()
    const Body = { x: CardArt.x + 10, right: CardArt.x + CardArt.width - 10 }
    let actionRows = $derived(card ? wrapLines(card.regularAction, 26) : [])
    let effectRows = $derived(card ? wrapLines(card.special.effect, 28) : [])
    let actionTop = 112
    let specialTop = $derived(actionTop + actionRows.length * 22 + 18)
</script>

<svg {x} {y} {width} {height} {viewBox} role="img" aria-label={label}>
    <title>{label}</title>
    {#if printedBackUrl}
        <image
            href={printedBackUrl}
            x="0"
            y="0"
            width={CardBox.width}
            height={CardBox.height}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    {:else if printedFace}
        <g transform="translate({PrintedCardPlace.x} 0) scale({PrintedCardPlace.scale})" data-print>
            <clipPath id={artClip}>
                <rect
                    x={PrintArtWindow.x}
                    y={PrintArtWindow.y}
                    width={PrintArtWindow.width}
                    height={PrintArtWindow.height}
                ></rect>
            </clipPath>
            <rect
                width={PrintedCard.width}
                height={PrintedCard.height}
                rx={PrintedCardCorner}
                fill={printedFace.band}
                data-print-band
            ></rect>
            <g fill="none" data-print-frame>
                <rect
                    {...bars}
                    rx={PrintFrame.round}
                    stroke="var(--feudum-print-line)"
                    stroke-width={PrintFrame.bar}
                ></rect>
                <rect
                    {...bars}
                    rx={PrintFrame.round}
                    stroke="var(--feudum-print-gold)"
                    stroke-width={PrintFrame.bar - 6}
                ></rect>
                <rect
                    {...lightBar}
                    rx={PrintFrame.round}
                    stroke="var(--feudum-print-gold-light)"
                    stroke-width="2.5"
                ></rect>
            </g>
            <image
                href={printedFace.url}
                x={printedFace.at.x}
                y={printedFace.at.y}
                width={PrintedArtFile.width * PrintedArtScale}
                height={PrintedArtFile.height * PrintedArtScale}
                clip-path="url(#{artClip})"
            ></image>
            {#each rosettes as { disc, rings }, index (index)}
                <path d={disc} fill="var(--feudum-print-corner)"></path>
                <path d={rings[0]} fill="none" stroke="var(--feudum-print-line)" stroke-width="3"
                ></path>
                <path d={rings[1]} fill="none" stroke="var(--feudum-print-gold)" stroke-width="5"
                ></path>
                <path d={rings[2]} fill="none" stroke="var(--feudum-print-line)" stroke-width="3"
                ></path>
            {/each}
        </g>
    {:else}
        <rect
            x="1"
            y="1"
            width={CardBox.width - 2}
            height={CardBox.height - 2}
            rx="14"
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="2"
        ></rect>
        {#if !card}
            <rect
                x={CardArt.x}
                y={CardArt.y}
                width={CardArt.width}
                height={CardArt.height}
                rx="10"
                fill="none"
                stroke="var(--feudum-parchment)"
                stroke-width="4"
            ></rect>
            <path
                d={CrownPath}
                transform="translate({CardBox.width / 2 - 60} {CardBox.height / 2 - 60}) scale(5)"
                fill="var(--feudum-parchment)"
            ></path>
        {:else}
            {#if url}
                <image
                    href={url}
                    x={CardArt.x}
                    y={CardArt.y}
                    width={CardArt.width}
                    height={CardArt.height}
                    preserveAspectRatio="xMidYMid meet"
                ></image>
            {:else}
                <rect
                    x={CardArt.x}
                    y={CardArt.y}
                    width={CardArt.width}
                    height={CardArt.height}
                    rx="10"
                    fill="var(--feudum-parchment)"
                    stroke="var(--feudum-parchment-shade)"
                    stroke-width="2"
                ></rect>
                <text
                    x={Body.x}
                    y="88"
                    font-size={tier === 'compact' ? 42 : 30}
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)"
                    >{tier === 'compact' ? shortName(card.printedName) : card.printedName}</text
                >
                <CardSymbolRow {card} right={Body.right} y={24} />
                {#if tier !== 'compact'}
                    <text
                        fill="var(--feudum-ink)"
                        font-size="19"
                        style:font-family="var(--feudum-font-text)"
                    >
                        {#each actionRows as row, index (index)}
                            <tspan x={Body.x} y={actionTop + index * 22}>{row}</tspan>
                        {/each}
                    </text>
                {/if}
                {#if tier === 'full'}
                    <line
                        x1={Body.x}
                        x2={Body.right}
                        y1={specialTop - 18}
                        y2={specialTop - 18}
                        stroke="var(--feudum-parchment-shade)"
                        stroke-width="2"
                    ></line>
                    <text
                        x={Body.x}
                        y={specialTop + 6}
                        font-size="22"
                        fill="var(--feudum-ink)"
                        style:font-family="var(--feudum-font-title)">{card.special.name}</text
                    >
                    {#each card.special.needs as need, index (index)}
                        {@const needX = Body.x + index * 34}
                        {@const needY = specialTop + 14}
                        {#if need.kind === 'good'}
                            <GoodToken good={need.good} size={28} x={needX} y={needY} />
                        {:else if need.kind === 'barrel-sulfur'}
                            <GoodToken good="sulfur" size={28} x={needX} y={needY} />
                        {:else if need.kind === 'shillings'}
                            <ShillingToken value={1} size={28} x={needX} y={needY} />
                        {:else}
                            <GuildIcon
                                guild={need.character}
                                size={28}
                                x={needX}
                                y={needY}
                                ink="var(--feudum-ink)"
                            />
                        {/if}
                    {/each}
                    <text
                        fill="var(--feudum-ink)"
                        font-size="17"
                        style:font-family="var(--feudum-font-text)"
                    >
                        {#each effectRows as row, index (index)}
                            <tspan x={Body.x} y={specialTop + 62 + index * 20}>{row}</tspan>
                        {/each}
                    </text>
                {/if}
            {/if}
            <circle cx="30" cy="30" r="20" fill={paint.fill} stroke={paint.edge} stroke-width="2"
            ></circle>
            <text
                x="30"
                y="38"
                text-anchor="middle"
                font-size="22"
                font-weight="700"
                fill={paint.ink}>{number}</text
            >
            {#if url && tier === 'compact'}
                <rect
                    x={CardArt.x}
                    y={CardBox.height - 90}
                    width={CardArt.width}
                    height="70"
                    fill="var(--feudum-parchment)"
                ></rect>
                <text
                    x={CardBox.width / 2}
                    y={CardBox.height - 40}
                    text-anchor="middle"
                    font-size="42"
                    fill="var(--feudum-ink)"
                    style:font-family="var(--feudum-font-title)">{shortName(card.printedName)}</text
                >
            {/if}
        {/if}
    {/if}
</svg>
