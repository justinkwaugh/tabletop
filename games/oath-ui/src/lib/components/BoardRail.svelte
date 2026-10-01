<script lang="ts">
    import RailBanners from '$lib/components/RailBanners.svelte'
    import RailDice from '$lib/components/RailDice.svelte'
</script>

<div class="rail">
    <RailBanners />
    <RailDice />
</div>

<style>
    .rail {
        display: flex;
        align-items: stretch;
        gap: 48px;
        height: 100%;
        padding: 16px 40px;
        background: linear-gradient(180deg, rgba(28, 25, 23, 0.96), rgba(12, 10, 9, 0.98));
        border-top: 2px solid rgba(180, 140, 80, 0.4);
        color: #e7e5e4;
    }
</style>
