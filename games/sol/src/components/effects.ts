import { Static, Type } from '@sinclair/typebox'

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

export enum EffectCategory {
    Simple = 'Simple',
    Complex = 'Complex',
    Conflict = 'Conflict'
}

export type Effect = Static<typeof Effect>
export const Effect = Type.Object({
    type: Type.Enum(EffectType),
    category: Type.Enum(EffectCategory)
})

export const Effects: Effect[] = [
    { type: EffectType.Accelerate, category: EffectCategory.Simple },
    { type: EffectType.Augment, category: EffectCategory.Simple },
    { type: EffectType.Blight, category: EffectCategory.Simple },
    { type: EffectType.Cascade, category: EffectCategory.Simple },
    { type: EffectType.Catapult, category: EffectCategory.Simple },
    { type: EffectType.Ceremony, category: EffectCategory.Simple },
    { type: EffectType.Chain, category: EffectCategory.Simple },
    { type: EffectType.Channel, category: EffectCategory.Simple },
    { type: EffectType.Cluster, category: EffectCategory.Simple },
    { type: EffectType.Duplicate, category: EffectCategory.Simple },
    { type: EffectType.Festival, category: EffectCategory.Simple },
    { type: EffectType.Fuel, category: EffectCategory.Simple },
    { type: EffectType.Hatch, category: EffectCategory.Simple },
    { type: EffectType.Hyperdrive, category: EffectCategory.Simple },
    { type: EffectType.Invade, category: EffectCategory.Simple },
    { type: EffectType.Juggernaut, category: EffectCategory.Simple },
    { type: EffectType.Metamorphosis, category: EffectCategory.Simple },
    { type: EffectType.Motivate, category: EffectCategory.Simple },
    { type: EffectType.Passage, category: EffectCategory.Simple },
    { type: EffectType.Pillar, category: EffectCategory.Simple },
    { type: EffectType.Portal, category: EffectCategory.Simple },
    { type: EffectType.Procreate, category: EffectCategory.Simple },
    { type: EffectType.Pulse, category: EffectCategory.Simple },
    { type: EffectType.Puncture, category: EffectCategory.Simple },
    { type: EffectType.Sacrifice, category: EffectCategory.Simple },
    { type: EffectType.Squeeze, category: EffectCategory.Simple },
    { type: EffectType.Synchronize, category: EffectCategory.Simple },
    { type: EffectType.Teleport, category: EffectCategory.Simple },
    { type: EffectType.Transcend, category: EffectCategory.Simple },
    { type: EffectType.Tribute, category: EffectCategory.Simple }
]
