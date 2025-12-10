<script lang="ts">
    import { EffectType } from '@tabletop/sol'
    import Accelerate from '$lib/images/effects/accelerate.png'
    import Augment from '$lib/images/effects/augment.png'
    import Blight from '$lib/images/effects/blight.png'
    import Cascade from '$lib/images/effects/cascade.png'
    import Catapult from '$lib/images/effects/catapult.png'
    import Ceremony from '$lib/images/effects/ceremony.png'
    import Chain from '$lib/images/effects/chain.png'
    import Channel from '$lib/images/effects/channel.png'
    import Cluster from '$lib/images/effects/cluster.png'
    import Duplicate from '$lib/images/effects/duplicate.png'
    import Festival from '$lib/images/effects/festival.png'
    import Fuel from '$lib/images/effects/fuel.png'
    import Hatch from '$lib/images/effects/hatch.png'
    import Hyperdrive from '$lib/images/effects/hyperdrive.png'
    import Invade from '$lib/images/effects/invade.png'
    import Juggernaut from '$lib/images/effects/juggernaut.png'
    import Metamorphosis from '$lib/images/effects/metamorphosis.png'
    import Motivate from '$lib/images/effects/motivate.png'
    import Passage from '$lib/images/effects/passage.png'
    import Pillar from '$lib/images/effects/pillar.png'
    import Portal from '$lib/images/effects/portal.png'
    import Procreate from '$lib/images/effects/procreate.png'
    import Pulse from '$lib/images/effects/pulse.png'
    import Puncture from '$lib/images/effects/puncture.png'
    import Sacrifice from '$lib/images/effects/sacrifice.png'
    import Squeeze from '$lib/images/effects/squeeze.png'
    import Synchronize from '$lib/images/effects/synchronize.png'
    import Teleport from '$lib/images/effects/teleport.png'
    import Transcend from '$lib/images/effects/transcend.png'
    import Tribute from '$lib/images/effects/tribute.png'

    let { effectType }: { effectType: EffectType } = $props()

    const effectImages: Record<EffectType, string> = {
        [EffectType.Accelerate]: Accelerate,
        [EffectType.Augment]: Augment,
        [EffectType.Blight]: Blight,
        [EffectType.Cascade]: Cascade,
        [EffectType.Catapult]: Catapult,
        [EffectType.Ceremony]: Ceremony,
        [EffectType.Chain]: Chain,
        [EffectType.Channel]: Channel,
        [EffectType.Cluster]: Cluster,
        [EffectType.Duplicate]: Duplicate,
        [EffectType.Festival]: Festival,
        [EffectType.Fuel]: Fuel,
        [EffectType.Hatch]: Hatch,
        [EffectType.Hyperdrive]: Hyperdrive,
        [EffectType.Invade]: Invade,
        [EffectType.Juggernaut]: Juggernaut,
        [EffectType.Metamorphosis]: Metamorphosis,
        [EffectType.Motivate]: Motivate,
        [EffectType.Passage]: Passage,
        [EffectType.Pillar]: Pillar,
        [EffectType.Portal]: Portal,
        [EffectType.Procreate]: Procreate,
        [EffectType.Pulse]: Pulse,
        [EffectType.Puncture]: Puncture,
        [EffectType.Sacrifice]: Sacrifice,
        [EffectType.Squeeze]: Squeeze,
        [EffectType.Synchronize]: Synchronize,
        [EffectType.Teleport]: Teleport,
        [EffectType.Transcend]: Transcend,
        [EffectType.Tribute]: Tribute
    }

    export function effectTypeToImage(effectType: EffectType): string {
        return effectImages[effectType]
    }

    export function effectTypeToBackgroundImage(effectType: EffectType): string {
        return `url("${effectTypeToImage(effectType)}")`
    }
</script>

<div
    class="bg-cover bg-center bg-no-repeat w-[250px] h-[184px]"
    style:background-image={effectTypeToBackgroundImage(effectType)}
></div>
