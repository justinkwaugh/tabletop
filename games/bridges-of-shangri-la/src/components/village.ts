import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'

import { Hydratable } from '@tabletop/common'
import { MasterType } from '../definition/masterType.js'

export type MasterAndStudents = Static<typeof MasterAndStudents>
export const MasterAndStudents = Type.Object({
    masterType: Type.Enum(MasterType),
    playerId: Type.String(),
    student: Type.Boolean()
})

export type Village = Static<typeof Village>
export const Village = Type.Object({
    spaces: Type.Record(Type.Enum(MasterType), Type.Optional(MasterAndStudents)),
    neighbors: Type.Array(Type.Number()),
    stone: Type.Boolean()
})

export const VillageValidator = Compile(Village)

export class HydratedVillage extends Hydratable<typeof Village> implements Village {
    declare spaces: Record<MasterType, MasterAndStudents | undefined>
    declare neighbors: number[]
    declare stone: boolean

    constructor(data: Village) {
        super(data, VillageValidator)
    }

    isAtPeace() {
        return this.stone
    }

    hasMaster(masterType: MasterType) {
        return this.spaces[masterType] !== undefined
    }

    hasStudent(masterType: MasterType) {
        return this.spaces[masterType]?.student === true
    }

    addMaster(masterType: MasterType, playerId: string) {
        if (this.spaces[masterType] !== undefined) {
            throw Error(`Village already has a ${masterType}`)
        }
        this.spaces[masterType] = { masterType, playerId, student: false }
    }

    getMasterAndStudents(masterType: MasterType): MasterAndStudents {
        const space = this.spaces[masterType]
        if (space === undefined) {
            throw Error(`Village does not have a ${masterType}`)
        }
        return space
    }

    addStudent(masterType: MasterType, playerId: string) {
        if (!this.hasMaster(masterType)) {
            throw Error(`Village does not have a ${masterType}`)
        }

        if (!this.isMasterOwnedByPlayer(masterType, playerId)) {
            throw Error(`Player ${playerId} does not own the ${masterType}`)
        }

        if (this.hasStudent(masterType)) {
            throw Error(`Village already has a student for ${masterType}`)
        }

        this.spaces[masterType]!.student = true
    }

    isMasterOwnedByPlayer(masterType: MasterType, playerId: string) {
        return this.spaces[masterType]?.playerId === playerId
    }

    numberOfMastersForPlayer(playerId: string): number {
        return Object.values(this.spaces).reduce((total, masterAndStudents) => {
            if (masterAndStudents?.playerId === playerId) {
                return total + 1
            }
            return total
        }, 0)
    }

    numberOfStudentsForPlayer(playerId: string): number {
        return Object.values(this.spaces).reduce((total, masterAndStudents) => {
            if (masterAndStudents?.playerId === playerId && masterAndStudents.student) {
                return total + 1
            }
            return total
        }, 0)
    }

    strength(): number {
        return Object.values(this.spaces).reduce((total, masterAndStudents) => {
            if (masterAndStudents !== undefined) {
                return total + (masterAndStudents.student ? 2 : 1)
            }
            return total
        }, 0)
    }

    numberOfMasters(): number {
        return Object.values(this.spaces).reduce((total, masterAndStudents) => {
            if (masterAndStudents !== undefined) {
                return total + 1
            }
            return total
        }, 0)
    }
}
