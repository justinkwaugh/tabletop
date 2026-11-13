export type SharedPair = readonly [left: number, right: number]

// Myers, "An O(ND) Difference Algorithm and Its Variations" (1986), with every step kept inside the edit grid.
export class CommonSubsequence {
    private readonly reach: DiagonalReach
    private readonly reachBeforeEdit: DiagonalReach[] = []

    private constructor(
        private readonly left: ArrayLike<number>,
        private readonly right: ArrayLike<number>
    ) {
        this.reach = new DiagonalReach(left.length + right.length + 1)
        this.reach.set(1, 0)
    }

    static between(
        left: ArrayLike<number>,
        right: ArrayLike<number>,
        workLimit: number
    ): SharedPair[] | undefined {
        const search = new CommonSubsequence(left, right)
        const edits = search.fewestEdits(workLimit)
        return edits === undefined ? undefined : search.pairsAfter(edits)
    }

    private fewestEdits(workLimit: number): number | undefined {
        const { left, right, reach } = this
        let work = 0
        for (let edits = 0; work <= workLimit; edits++) {
            this.reachBeforeEdit.push(reach.within(edits + 1))
            for (let diagonal = -edits; diagonal <= edits; diagonal += 2) {
                let leftAt = Math.max(
                    this.afterInsert(reach, diagonal),
                    this.afterRemove(reach, diagonal)
                )
                if (leftAt >= 0) {
                    let rightAt = leftAt - diagonal
                    while (
                        leftAt < left.length &&
                        rightAt < right.length &&
                        left[leftAt] === right[rightAt]
                    ) {
                        leftAt++
                        rightAt++
                        work++
                    }
                    if (leftAt === left.length && rightAt === right.length) return edits
                }
                reach.set(diagonal, leftAt)
                work++
            }
        }
        return undefined
    }

    private pairsAfter(edits: number): SharedPair[] {
        const pairs: SharedPair[] = []
        let leftAt = this.left.length
        let rightAt = this.right.length
        for (let edit = edits; edit > 0; edit--) {
            const before = this.reachBeforeEdit[edit]
            const diagonal = leftAt - rightAt
            const inserted =
                this.afterInsert(before, diagonal) >= this.afterRemove(before, diagonal)
            const previousDiagonal = inserted ? diagonal + 1 : diagonal - 1
            const previousLeft = before.on(previousDiagonal)
            const afterEdit = inserted ? previousLeft : previousLeft + 1
            while (leftAt > afterEdit) pairs.push([--leftAt, --rightAt])
            leftAt = previousLeft
            rightAt = previousLeft - previousDiagonal
        }
        while (leftAt > 0) pairs.push([--leftAt, --rightAt])
        return pairs.reverse()
    }

    private afterInsert(reach: DiagonalReach, diagonal: number): number {
        const leftAt = reach.on(diagonal + 1)
        return leftAt >= 0 && leftAt - diagonal <= this.right.length ? leftAt : -1
    }

    private afterRemove(reach: DiagonalReach, diagonal: number): number {
        const leftAt = reach.on(diagonal - 1)
        return leftAt >= 0 && leftAt < this.left.length ? leftAt + 1 : -1
    }
}

// How far along the left side the search has got on each diagonal (left position minus right position); -1 where nowhere.
class DiagonalReach {
    private readonly leftPositions: Int32Array

    constructor(
        private readonly furthestDiagonal: number,
        leftPositions?: Int32Array
    ) {
        this.leftPositions = leftPositions ?? new Int32Array(2 * furthestDiagonal + 1).fill(-1)
    }

    on(diagonal: number): number {
        return this.leftPositions[diagonal + this.furthestDiagonal]
    }

    set(diagonal: number, leftPosition: number): void {
        this.leftPositions[diagonal + this.furthestDiagonal] = leftPosition
    }

    within(furthestDiagonal: number): DiagonalReach {
        return new DiagonalReach(
            furthestDiagonal,
            this.leftPositions.slice(
                this.furthestDiagonal - furthestDiagonal,
                this.furthestDiagonal + furthestDiagonal + 1
            )
        )
    }
}
