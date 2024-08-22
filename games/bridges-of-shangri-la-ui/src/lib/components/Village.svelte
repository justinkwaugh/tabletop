<script lang="ts">
    import healer from '$lib/images/healer.png'
    import rainmaker from '$lib/images/rainmaker.png'
    import dragonbreeder from '$lib/images/dragonbreeder.png'
    import firekeeper from '$lib/images/firekeeper.png'
    import priest from '$lib/images/priest.png'
    import yetiwhisperer from '$lib/images/yetiwhisperer.png'
    import astrologer from '$lib/images/astrologer.png'
</script>

<div class="relative">
    <div class="absolute w-[49px] h-[50px] top-0 left-[27px] bg-[#fae54b] border-2 border-gray-800">
        <img src={rainmaker} alt="rain maker" />
    </div>
    <div class="absolute w-[49px] h-[50px] top-0 left-[78px] bg-[#9a0ee6] border-2 border-gray-800">
        <img src={astrologer} alt="astrologer" />
    </div>
    <div class="absolute w-[49px] h-[50px] top-[52px] left-0 bg-[#0d56ad] border-2 border-gray-800">
        <img src={dragonbreeder} alt="dragon breeder" />
    </div>
    <div
        class="absolute w-[49px] h-[50px] top-[52px] left-[51px] bg-[#fae54b] border-2 border-gray-800"
    >
        <img src={priest} alt="priest" />
    </div>
    <div
        class="absolute w-[49px] h-[50px] top-[52px] left-[102px] bg-[#ad0207] border-2 border-gray-800"
    >
        <img src={yetiwhisperer} alt="yeti whisperer" />
    </div>
    <div
        class="absolute w-[49px] h-[50px] top-[105px] left-[25px] bg-[#9a0ee6] border-2 border-gray-800"
    >
        <img src={firekeeper} alt="fire keeper" />
    </div>
    <div
        class="absolute w-[49px] h-[50px] top-[105px] left-[76px] bg-[#ad0207] border-2 border-gray-800"
    >
        <img src={healer} alt="healer" />
    </div>
</div>
