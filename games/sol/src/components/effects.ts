import { type Static, Type } from '@sinclair/typebox'

export enum EffectType {
    Accelerate = 'Accelerate',
    Augment = 'Augment',
    Blight = 'Blight',
    Cascade = 'Cascade',
    Catapult = 'Catapult',
    Ceremony = 'Ceremony',
    Chain = 'Chain',
    Channel = 'Channel',
    Cluster = 'Cluster',
    Duplicate = 'Duplicate',
    Festival = 'Festival',
    Fuel = 'Fuel',
    Hatch = 'Hatch',
    Hyperdrive = 'Hyperdrive',
    Invade = 'Invade',
    Juggernaut = 'Juggernaut',
    Metamorphosis = 'Metamorphosis',
    Motivate = 'Motivate',
    Passage = 'Passage',
    Pillar = 'Pillar',
    Portal = 'Portal',
    Procreate = 'Procreate',
    Pulse = 'Pulse',
    Puncture = 'Puncture',
    Sacrifice = 'Sacrifice',
    Squeeze = 'Squeeze',
    Synchronize = 'Synchronize',
    Teleport = 'Teleport',
    Transcend = 'Transcend',
    Tribute = 'Tribute'
}

export enum EffectColor {
    Red = 'Red',
    Green = 'Green',
    Blue = 'Blue',
    Yellow = 'Yellow'
}

export type Effect = Static<typeof Effect>
export const Effect = Type.Object({
    type: Type.Enum(EffectType),
    color: Type.Enum(EffectColor)
})

export const Effects: Effect[] = [
    { type: EffectType.Accelerate, color: EffectColor.Yellow },
    { type: EffectType.Augment, color: EffectColor.Yellow },
    { type: EffectType.Blight, color: EffectColor.Yellow },
    { type: EffectType.Cascade, color: EffectColor.Blue },
    { type: EffectType.Catapult, color: EffectColor.Blue },
    { type: EffectType.Ceremony, color: EffectColor.Blue },
    { type: EffectType.Chain, color: EffectColor.Yellow },
    { type: EffectType.Channel, color: EffectColor.Green },
    { type: EffectType.Cluster, color: EffectColor.Green },
    { type: EffectType.Duplicate, color: EffectColor.Green },
    { type: EffectType.Festival, color: EffectColor.Yellow },
    { type: EffectType.Fuel, color: EffectColor.Green },
    { type: EffectType.Hatch, color: EffectColor.Red },
    { type: EffectType.Hyperdrive, color: EffectColor.Yellow },
    { type: EffectType.Invade, color: EffectColor.Red },
    { type: EffectType.Juggernaut, color: EffectColor.Blue },
    { type: EffectType.Metamorphosis, color: EffectColor.Green },
    { type: EffectType.Motivate, color: EffectColor.Blue },
    { type: EffectType.Passage, color: EffectColor.Green },
    { type: EffectType.Pillar, color: EffectColor.Yellow },
    { type: EffectType.Portal, color: EffectColor.Yellow },
    { type: EffectType.Procreate, color: EffectColor.Blue },
    { type: EffectType.Pulse, color: EffectColor.Green },
    { type: EffectType.Puncture, color: EffectColor.Blue },
    { type: EffectType.Sacrifice, color: EffectColor.Yellow },
    { type: EffectType.Squeeze, color: EffectColor.Yellow },
    { type: EffectType.Synchronize, color: EffectColor.Green },
    { type: EffectType.Teleport, color: EffectColor.Yellow },
    { type: EffectType.Transcend, color: EffectColor.Yellow },
    { type: EffectType.Tribute, color: EffectColor.Red }
]

export function blueEffects(): Effect[] {
    return Effects.filter((effect) => effect.color === EffectColor.Blue)
}

export function greenEffects(): Effect[] {
    return Effects.filter((effect) => effect.color === EffectColor.Green)
}

export function yellowEffects(): Effect[] {
    return Effects.filter((effect) => effect.color === EffectColor.Yellow)
}

export function redEffects(): Effect[] {
    return Effects.filter((effect) => effect.color === EffectColor.Red)
}
