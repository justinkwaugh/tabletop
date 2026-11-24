<script lang="ts">
    import Level from './Level.svelte'
    import { beadValue, rosaryBeadSum, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import {
        CofferBox,
        GuildSizes,
        RosaryTotalAt,
        guildPrinted,
        guildSlot,
        rosaryBead
    } from '$lib/utils/boardGeometry.js'
    import { PrintedCounts } from '$lib/utils/printedGuilds.js'
    import StateNote from './StateNote.svelte'

    /** R-4.6.5 The rosary's beads are public, and so its total. */
    let { state }: { state: HydratedFeudumGameState } = $props()

    let coffer = $derived(guildSlot('guild.monk.coffer'))
    let printed = $derived(guildPrinted('monk'))
</script>

{#each state.guilds.monk.rosary as sealId, index (sealId)}
    {@const at = rosaryBead(index)}
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
{/each}
{#if printed}
    <StateNote
        x={PrintedCounts.rosary.x}
        y={PrintedCounts.rosary.y}
        text="Rosary · {rosaryBeadSum(state)}"
        size={18}
        data-rosary-total={rosaryBeadSum(state)}
    />
{:else}
    <Level at={{ x: RosaryTotalAt.x, y: RosaryTotalAt.y }}
        ><text
            x={RosaryTotalAt.x}
            y={RosaryTotalAt.y}
            text-anchor="middle"
            font-size="18"
            fill="var(--feudum-ink)"
            data-rosary-total={rosaryBeadSum(state)}>Rosary · {rosaryBeadSum(state)}</text
        ></Level
    >

    <rect
        x={CofferBox.x}
        y={CofferBox.y}
        width={CofferBox.width}
        height={CofferBox.height}
        rx="8"
        fill="var(--feudum-parchment-shade)"
        stroke="var(--feudum-ink)"
    ></rect>
    <Level at={{ x: CofferBox.x + CofferBox.width / 2, y: CofferBox.y + 26 }}
        ><text
            x={CofferBox.x + CofferBox.width / 2}
            y={CofferBox.y + 26}
            text-anchor="middle"
            font-size="18"
            fill="var(--feudum-ink)">Coffer</text
        ></Level
    >
{/if}
<BoardPiece at={coffer} piece="coffer">
    <ShillingToken
        value={1}
        size={GuildSizes.shilling}
        x={-GuildSizes.shilling / 2}
        y={-GuildSizes.shilling / 2}
    />
</BoardPiece>
{#if printed}
    <StateNote
        x={PrintedCounts.coffer.x}
        y={PrintedCounts.coffer.y}
        text="{state.guilds.monk.coffer}s"
        data-coffer={state.guilds.monk.coffer}
    />
{:else}
    <Level at={{ x: coffer.x, y: coffer.y + 56 }}
        ><text
            x={coffer.x}
            y={coffer.y + 56}
            text-anchor="middle"
            font-size="24"
            font-weight="700"
            fill="var(--feudum-ink)"
            data-coffer={state.guilds.monk.coffer}>{state.guilds.monk.coffer}s</text
        ></Level
    >
{/if}
