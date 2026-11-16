<script lang="ts">
    import { PIECE_KINDS } from '@tabletop/punct'
    import { Color } from '@tabletop/common'
    import {
        bodyBox,
        bodyLooks,
        dishBox,
        DISH_LOOKS,
        holeBox,
        lookName,
        TONES
    } from '$lib/board/looks.js'
    import PieceBody from '$lib/components/PieceBody.svelte'
    import DishLook from '$lib/components/DishLook.svelte'
    import HoleLook from '$lib/components/HoleLook.svelte'
    import PieceDefs from '$lib/components/PieceDefs.svelte'
    import PieceIcon from '$lib/components/PieceIcon.svelte'

    // Every look, each in an SVG of its own, for scripts/render-looks.mjs to save as files: each
    // body outline lying every way it can on screen, each dish, and each icon. Drawn live here,
    // and nowhere else in the game.
    const bodies = bodyLooks()
    const dish = dishBox()
    const hole = holeBox()
</script>

<div class="looks">
    {#each TONES as tone (tone)}
        {#each bodies as body (body.name)}
            {@const box = bodyBox(body.kind, body.angle)}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                data-look={lookName(body, tone)}
                viewBox="{box.x} {box.y} {box.width} {box.height}"
                width={box.width * 2}
                height={box.height * 2}
            >
                <defs><PieceDefs prefix="l" /></defs>
                <PieceBody kind={body.kind} angle={body.angle} {tone} prefix="l" />
            </svg>
        {/each}
    {/each}
    {#each DISH_LOOKS as look (look)}
        <svg
            xmlns="http://www.w3.org/2000/svg"
            data-look="dish-{look}"
            viewBox="{dish.x} {dish.y} {dish.width} {dish.height}"
            width={dish.width * 4}
            height={dish.height * 4}
        >
            <defs><PieceDefs prefix="l" /></defs>
            <DishLook material={look} prefix="l" />
        </svg>
    {/each}
    <svg
        xmlns="http://www.w3.org/2000/svg"
        data-look="hole"
        viewBox="{hole.x} {hole.y} {hole.width} {hole.height}"
        width={hole.width * 4}
        height={hole.height * 4}
    >
        <HoleLook prefix="l" />
    </svg>
    {#each TONES as tone (tone)}
        {#each PIECE_KINDS as kind (kind)}
            <span data-icon="icon-{tone}-{kind}">
                <PieceIcon
                    color={tone === 'light' ? Color.White : Color.Black}
                    {kind}
                    scale={0.5}
                    live
                />
            </span>
        {/each}
    {/each}
</div>

<style>
    .looks {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px;
        background: #86a08d;
    }
</style>
