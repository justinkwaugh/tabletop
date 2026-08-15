<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ActionCard, MidBottomBand } from '@tabletop/lowenherz'
    import type { ActionCardSlot } from '$lib/model/actionCardTypes.js'
    import iconCrownScepter from '$lib/images/action-cards/icons/icon-crown-scepter.png'
    import iconKnight from '$lib/images/action-cards/icons/icon-knight.png'
    import iconKnightDouble from '$lib/images/action-cards/icons/icon-knight-double.png'
    import iconWallOne from '$lib/images/action-cards/icons/icon-wall-one.png'
    import iconWallTwo from '$lib/images/action-cards/icons/icon-walls.png'
    import iconWallThree from '$lib/images/action-cards/icons/icon-wall-three.png'
    import iconMoneybag from '$lib/images/action-cards/icons/icon-moneybag.png'
    import silverMine from '$lib/images/action-cards/silver-mine.jpg'
    import kingIsDead from '$lib/images/action-cards/king-is-dead.jpg'

    let {
        card,
        slots
    }: {
        card: ActionCard
        // Only meaningful for standard cards - clicking a band picks that slot's
        // decision card, and pills show who's chosen it so far. Omitted entirely by
        // non-interactive usages (deck previews, history thumbnails).
        slots?: { top: ActionCardSlot; middle: ActionCardSlot; bottom: ActionCardSlot }
    } = $props()

    const numeralStyle = "font-family:'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif"

    // Optically centres a player's initial inside its pill. Flexbox centres the LINE BOX,
    // not the glyph, and IM Fell English's line box is badly lopsided: 0.905em of ascent
    // against 0.363em of descent puts the box centre 0.271em above the baseline, while a
    // capital's ink centres at about 0.35em. Every letter therefore rides ~0.08em high
    // until it's pushed back down.
    // J and Q are the exceptions - measured against a fixed baseline they drop ~0.29em
    // below it, where every other capital sits on it, so their ink centre falls BELOW the
    // box centre and they need lifting instead. (Both numbers are measured off the
    // shipped TTF, same method as Numeral.svelte's digit table.)
    const CAP_SHIFT = '0.08em'
    const DESCENDING_CAP_SHIFT: Record<string, string> = { J: '-0.06em', Q: '-0.064em' }
    function capShift(letter: string): string {
        return DESCENDING_CAP_SHIFT[letter] ?? CAP_SHIFT
    }
</script>

{#snippet numeral(value: number)}
    <span
        class="absolute left-[3cqw] top-[1.5cqw] font-bold text-[32.5cqw] text-[#2b2b2b]"
        style={numeralStyle}
    >
        {value}
    </span>
{/snippet}

{#snippet pillStack(pills: ActionCardSlot['pills'], side: 'left' | 'right')}
    {#if pills.length > 0}
        <!-- Straddles the card's edge (half on, half off) instead of sitting over
             the band's icon, so the icon is never obscured. -->
        <div
            class="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none z-20 {side ===
            'right'
                ? 'right-0 translate-x-1/2'
                : 'left-0 -translate-x-1/2'}"
        >
            {#each pills as pill (pill.playerId)}
                {@const letter = pill.name.charAt(0).toUpperCase()}
                <span
                    class="pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-black/20 shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
                    style="background-color:{pill.color}; color:{pill.textColor}"
                    title={pill.name}
                >
                    <!-- translate rather than padding/line-height: it moves the glyph
                         without resizing the pill or shifting the one stacked below it. -->
                    <span style="display: block; transform: translateY({capShift(letter)});">
                        {letter}
                    </span>
                </span>
            {/each}
        </div>
    {/if}
{/snippet}

{#snippet pills(slot: ActionCardSlot | undefined)}
    {#if slot && slot.pills.length > 0}
        <!-- First 2 pickers stack on the right edge (as before); a 3rd/4th (a tie)
             stack on the left edge instead of crowding the right. -->
        {@render pillStack(slot.pills.slice(0, 2), 'right')}
        {@render pillStack(slot.pills.slice(2, 4), 'left')}
    {/if}
{/snippet}

{#snippet band(slot: ActionCardSlot | undefined, bg: string, content: Snippet, roundedClass: string)}
    {@const interactive = Boolean(slot?.clickable && slot?.onClick)}
    <button
        type="button"
        disabled={!interactive}
        class="appearance-none border-0 flex-1 min-w-0 min-h-0 relative flex items-center justify-center p-3 text-left {roundedClass} {interactive
            ? 'cursor-pointer hover:brightness-95'
            : 'cursor-default'}"
        style="background-color:{bg}"
        onclick={interactive ? slot!.onClick : undefined}
    >
        {@render content()}
        {@render pills(slot)}
    </button>
{/snippet}

{#snippet wallIcon(count: 1 | 2 | 3)}
    {#if count === 1}
        <img src={iconWallOne} alt="1 border" class="h-full max-w-full object-contain" />
    {:else if count === 2}
        <img src={iconWallTwo} alt="2 borders" class="h-full max-w-full object-contain scale-[1.15]" />
    {:else}
        <img src={iconWallThree} alt="3 borders" class="h-full max-w-full object-contain scale-[1.3]" />
    {/if}
{/snippet}

{#snippet midBottomBandContent(bandData: MidBottomBand)}
    {#if bandData.kind === 'border'}
        {@render wallIcon(bandData.count)}
    {:else if bandData.count === 2}
        <img src={iconKnightDouble} alt="knight" class="h-full max-w-full object-contain scale-110" />
    {:else}
        <img src={iconKnight} alt="knight" class="h-full max-w-full object-contain" />
    {/if}
{/snippet}

{#snippet topContent()}
    {#if card.type === 'standard'}
        {#if card.top.kind === 'income'}
            {@render numeral(card.top.value)}
            <img src={iconMoneybag} alt="income" class="h-full max-w-full object-contain translate-x-[10%]" />
        {:else}
            <img src={iconCrownScepter} alt="politics" class="h-full max-w-full object-contain scale-[1.15]" />
        {/if}
    {/if}
{/snippet}

{#snippet middleContent()}
    {#if card.type === 'standard'}
        {@render midBottomBandContent(card.middle)}
    {/if}
{/snippet}

{#snippet bottomContent()}
    {#if card.type === 'standard'}
        {@render midBottomBandContent(card.bottom)}
    {/if}
{/snippet}

<!-- Not overflow-hidden - the right-edge picker circles are meant to spill half
     outside the card. The rounded outer silhouette instead comes from rounding the
     top/bottom bands' own corners (see the roundedClass args below). -->
<div class="@container aspect-[546/840] w-full rounded-md border border-black/20 shadow-md bg-white">
    {#if card.type === 'mining'}
        <img src={silverMine} alt="Silver Mine" class="w-full h-full object-cover rounded-md" />
    {:else if card.type === 'kingIsDead'}
        <img src={kingIsDead} alt="The King is Dead" class="w-full h-full object-cover rounded-md" />
    {:else}
        <div class="flex flex-col w-full h-full min-w-0">
            {@render band(slots?.top, '#BFCFAE', topContent, 'rounded-t-md')}
            {@render band(slots?.middle, '#EEE5A9', middleContent, '')}
            {@render band(slots?.bottom, '#B3CBDF', bottomContent, 'rounded-b-md')}
        </div>
    {/if}
</div>
