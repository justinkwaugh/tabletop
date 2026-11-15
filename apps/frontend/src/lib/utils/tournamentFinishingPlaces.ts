import {
    tournamentFinishingPlacesFromGroups,
    tournamentFinishingWinners,
    type CorrectTournamentResultRequest,
    type TournamentFinishingPlaces
} from '@tabletop/common'

export function standingsPlaces(places: TournamentFinishingPlaces): Record<string, number> {
    const values = Object.values(places)
    return Object.fromEntries(
        Object.entries(places).map(([userId, place]) => [
            userId,
            values.filter((other) => other < place).length + 1
        ])
    )
}

export function finishingPlacesFromNumbers(
    numbers: Record<string, number>
): TournamentFinishingPlaces {
    const groups = new Map<number, string[]>()
    for (const [userId, number] of Object.entries(numbers)) {
        const group = groups.get(number)
        if (group) group.push(userId)
        else groups.set(number, [userId])
    }
    return tournamentFinishingPlacesFromGroups(
        [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group)
    )
}

export function placementCorrection(
    numbers: Record<string, number>
): Pick<CorrectTournamentResultRequest, 'winningUserIds' | 'finishingPlaces'> {
    const finishingPlaces = finishingPlacesFromNumbers(numbers)
    return { winningUserIds: tournamentFinishingWinners(finishingPlaces), finishingPlaces }
}
