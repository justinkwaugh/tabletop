<script lang="ts">
    import type { Snippet } from 'svelte'

    let { title, children, footer }: { title: string; children: Snippet; footer?: Snippet } =
        $props()
</script>

<div class="aid-card relative w-[262px] select-none rounded-[10px] text-[#2b1a0a]">
    <!-- A thin gilt ring just inside the dark outer edge - the double-frame look every
         card in the box has, without needing a border image. -->
    <div class="pointer-events-none absolute inset-[3px] rounded-[7px] border border-[#a9843c]/45"></div>

    <div class="aid-header rounded-t-[8px] px-3 py-[6px] text-center">
        <span class="aid-title text-[23px] leading-tight">{title}</span>
    </div>

    {@render children()}

    {#if footer}
        <div
            class="rounded-b-[8px] border-t-2 border-[#3b2410]/40 bg-[#3b2410]/[0.07] px-3 py-[7px] text-center text-[13px] italic leading-snug"
        >
            {@render footer()}
        </div>
    {/if}
</div>

<style>
    /* Aged parchment: a warm base, a lit corner, and a grubby opposite corner - enough
       variation that it doesn't read as a flat beige rectangle at this size. */
    .aid-card {
        background-color: #f0dfba;
        background-image:
            radial-gradient(ellipse at 18% 12%, rgba(255, 255, 255, 0.55), transparent 55%),
            radial-gradient(ellipse at 88% 85%, rgba(120, 80, 30, 0.18), transparent 60%),
            linear-gradient(160deg, #f7eaca 0%, #eddbb4 45%, #dfc998 100%);
        border: 2px solid #3b2410;
        box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.45),
            inset 0 0 18px rgba(120, 80, 30, 0.15);
    }

    .aid-header {
        background-image: linear-gradient(180deg, #7c3b2a 0%, #5d281c 55%, #4a1f15 100%);
        border-bottom: 2px solid #3b2410;
        box-shadow: inset 0 1px 0 rgba(255, 226, 180, 0.25);
    }

    /* No font-family of its own - inherits IM Fell English from the app, same as the
       body and footer below it, so the whole card is set in one face. */
    .aid-title {
        color: #f6e8c8;
        letter-spacing: 0.015em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    }
</style>
