import { assertExists } from '@tabletop/common'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { gainSupply } from '../util/rest.js'
import { registerBattlePlan } from './registry.js'

// "+[defenseDie]" — defender. Cost: place 1 favor.
registerBattlePlan(
    'denizen.hearth.extra-provisions',
    powerIndexOf('denizen.hearth.extra-provisions', PowerTiming.BattlePlan),
    {
        hooks: { dice: () => ({ defense: 1 }) }
    }
)

// "+2[defenseDie] At end, discard Storm Caller." — defender, cost-free, so the bandits use it (R-5.5.3).
registerBattlePlan(
    'denizen.nomad.storm-caller',
    powerIndexOf('denizen.nomad.storm-caller', PowerTiming.BattlePlan),
    {
        hooks: { dice: () => ({ defense: 2 }), discardAtEnd: true }
    }
)

// "Gain 1 Supply." — attacker.
registerBattlePlan(
    'denizen.order.scouts',
    powerIndexOf('denizen.order.scouts', PowerTiming.BattlePlan),
    {
        hooks: {
            onUse: (ctx) => {
                assertExists(
                    ctx.playerId,
                    'Scouts is an attacker plan, and the bandits only defend'
                )
                return `Scouts: gained ${gainSupply(ctx.state, ctx.playerId, 1)} Supply`
            }
        }
    }
)

// "Ignore all skulls you roll." — attacker.
registerBattlePlan(
    'denizen.order.outriders',
    powerIndexOf('denizen.order.outriders', PowerTiming.BattlePlan),
    {
        hooks: { ignoreSkulls: true }
    }
)
