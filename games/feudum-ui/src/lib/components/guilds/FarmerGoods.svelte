<script lang="ts">
    import Level from './Level.svelte'
    import {
        ChickenSpaces,
        FarmerBarn,
        FarmerPurse,
        beadValue,
        goodsTotal,
        type HydratedFeudumGameState
    } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import CountChip from '$lib/components/map/CountChip.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import { goodStacks } from '$lib/model/mapView.js'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import {
        BarnBox,
        GuildSizes,
        barnTokenAt,
        guildPrinted,
        guildSlot
    } from '$lib/utils/boardGeometry.js'
    import { PrintedCounts } from '$lib/utils/printedGuilds.js'
    import StateNote from './StateNote.svelte'
    import { ChickenPath } from '$lib/utils/trackShape.js'

    /**
     * R-1.3 The barn, with its limit from the data. R-1.4-H3 The chickens, each a bead or nothing;
     * their spaces come from the provisional registry through the data. R-4.6.2 The farmer's purse.
     */
    let { state }: { state: HydratedFeudumGameState } = $props()

    let farmer = $derived(state.guilds.farmer)
    let purse = $derived(guildSlot(FarmerPurse.id))
    /** The printed panel draws the farmyard, the hens and the purse; the counts stand on pills. */
    let printed = $derived(guildPrinted('farmer'))
</script>

{#if printed}
    <StateNote
        x={PrintedCounts.barn.x}
        y={PrintedCounts.barn.y}
        text="{goodsTotal(farmer.barn)} of {FarmerBarn.capacity}"
        size={18}
        data-barn={goodsTotal(farmer.barn)}
    />
{:else}
    <rect
        x={BarnBox.x}
        y={BarnBox.y}
        width={BarnBox.width}
        height={BarnBox.height}
        rx="8"
        fill="var(--feudum-parchment-shade)"
        stroke="var(--feudum-ink)"
    ></rect>
    <Level at={{ x: BarnBox.x + 12, y: BarnBox.y + 26 }}
        ><text
            x={BarnBox.x + 12}
            y={BarnBox.y + 26}
            font-size="18"
            fill="var(--feudum-ink)"
            data-barn={goodsTotal(farmer.barn)}
            >Barn · {goodsTotal(farmer.barn)} of {FarmerBarn.capacity}</text
        ></Level
    >
{/if}
{#each goodStacks(farmer.barn) as stack (stack.good)}
    {#each Array.from({ length: stack.tokens }, (_, index) => index) as index (index)}
        <BoardPiece
            at={barnTokenAt(stack.good, index)}
            piece="good:{FarmerBarn.id}:{stack.good}:{index}"
        >
            <GoodToken
                good={stack.good}
                size={GuildSizes.good}
                x={-GuildSizes.good / 2}
                y={-GuildSizes.good / 2}
            />
            {#if stack.count}
                <CountChip count={stack.count} x={14} y={-14} />
            {/if}
        </BoardPiece>
    {/each}
{/each}

{#each ChickenSpaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    {@const sealId = farmer.chickens[space.id]}
    {#if !printed}
        <svg
            x={at.x - 36}
            y={at.y - 36}
            width="72"
            height="72"
            viewBox="0 0 24 24"
            data-chicken={space.id}
        >
            <path
                d={ChickenPath}
                fill="var(--feudum-parchment-shade)"
                stroke="var(--feudum-ink)"
                stroke-width="0.8"
            ></path>
        </svg>
    {/if}
    {#if sealId}
        <BoardPiece {at} piece="bead:{sealId}">
            <Enlargeable
                label="bead"
                face={() => ({
                    kind: 'bead',
                    faceShown: sealFaceShown(true),
                    beadValue: beadValue(sealId)
                })}
            >
                <SealFace
                    faceShown={sealFaceShown(true)}
                    beadValue={beadValue(sealId)}
                    size={GuildSizes.bead}
                    x={-GuildSizes.bead / 2}
                    y={-GuildSizes.bead / 2}
                />
            </Enlargeable>
        </BoardPiece>
    {/if}
{/each}

{#if !printed}
    <Level at={{ x: purse.x - 30, y: purse.y + 7 }}
        ><text
            x={purse.x - 30}
            y={purse.y + 7}
            text-anchor="end"
            font-size="18"
            fill="var(--feudum-ink)">Purse</text
        ></Level
    >
{/if}
<BoardPiece at={purse} piece="purse">
    <ShillingToken
        value={1}
        size={GuildSizes.shilling}
        x={-GuildSizes.shilling / 2}
        y={-GuildSizes.shilling / 2}
    />
</BoardPiece>
{#if printed}
    <StateNote
        x={PrintedCounts.purse.x}
        y={PrintedCounts.purse.y}
        text="{farmer.purse}s"
        data-purse={farmer.purse}
    />
{:else}
    <Level at={{ x: purse.x + 30, y: purse.y + 8 }}
        ><text
            x={purse.x + 30}
            y={purse.y + 8}
            font-size="24"
            font-weight="700"
            fill="var(--feudum-ink)"
            data-purse={farmer.purse}>{farmer.purse}s</text
        ></Level
    >
{/if}
