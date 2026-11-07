<script lang="ts">
    import { beadValue, rosaryBeadSum, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import {
        CofferBox,
        GuildSizes,
        RosaryTotalAt,
        guildSlot,
        rosaryBead
    } from '$lib/utils/boardGeometry.js'

    /** R-4.6.5 The rosary's beads are public, and so its total. R-4.6.2 The church coffer's shillings. */
    let { state }: { state: HydratedFeudumGameState } = $props()

    let coffer = $derived(guildSlot('guild.monk.coffer'))
</script>

{#each state.guilds.monk.rosary as sealId, index (sealId)}
    {@const at = rosaryBead(index)}
    <BoardPiece {at} piece="bead:{sealId}">
        <SealFace
            faceShown={sealFaceShown(true)}
            beadValue={beadValue(sealId)}
            size={GuildSizes.bead}
            x={-GuildSizes.bead / 2}
            y={-GuildSizes.bead / 2}
        />
    </BoardPiece>
{/each}
<text
    x={RosaryTotalAt.x}
    y={RosaryTotalAt.y}
    text-anchor="middle"
    font-size="18"
    fill="var(--feudum-ink)"
    data-rosary-total={rosaryBeadSum(state)}>Rosary · {rosaryBeadSum(state)}</text
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
<text
    x={CofferBox.x + CofferBox.width / 2}
    y={CofferBox.y + 26}
    text-anchor="middle"
    font-size="18"
    fill="var(--feudum-ink)">Coffer</text
>
<BoardPiece at={coffer} piece="coffer">
    <ShillingToken
        value={1}
        size={GuildSizes.shilling}
        x={-GuildSizes.shilling / 2}
        y={-GuildSizes.shilling / 2}
    />
</BoardPiece>
<text
    x={coffer.x}
    y={coffer.y + 56}
    text-anchor="middle"
    font-size="24"
    font-weight="700"
    fill="var(--feudum-ink)"
    data-coffer={state.guilds.monk.coffer}>{state.guilds.monk.coffer}s</text
>
