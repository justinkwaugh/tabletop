use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use std::rc::Rc;

mod alike;
mod fleet;
mod outlook;
mod pair;

#[derive(Deserialize)]
pub struct Problem {
    #[serde(default)]
    fleet: Option<fleet::Policy>,
    version: u32,
    stops: Vec<Stop>,
    arcs: Vec<Arc>,
    trains: Vec<Train>,
    resource_count: usize,
    junction_count: usize,
    group_count: usize,
    hex_bonuses: Vec<i32>,
    #[serde(default)]
    longest_route_bonus_per_stop: i32,
    /// Cities and towns a route must visit; offboards do not count.
    #[serde(default)]
    minimum_cities_and_towns: u32,
    /// A route may not leave a hex and enter it again.
    #[serde(default)]
    no_reentry: bool,
    /// The hexes a route may not leave and enter again, when not every hex.
    #[serde(default)]
    no_reentry_hexes: Vec<bool>,
    /// How many blocked cities or towns the company's routes may run through, all together.
    #[serde(default)]
    blocked_passes: u32,
    budget_ms: f64,
    /// The time the stages of the search are paced for, where the time left to it is not the
    /// time it was planned with: one of several searches that share a limit has what the
    /// others left, and takes the same course as if it had its even part.
    #[serde(default)]
    pace_ms: Option<f64>,
    memory_budget_bytes: usize,
    /// The stop groups that only so many of the run's routes may stop in.
    #[serde(default)]
    group_route_limits: Vec<GroupRouteLimit>,
    /// The limits that fewer routes may reach than there are trains, once each has its piece.
    #[serde(skip)]
    quotas: Vec<Quota>,
}

#[derive(Deserialize)]
struct GroupRouteLimit {
    group: usize,
    routes: usize,
}

/// A stop group's limit as a piece of track: a route runs on the piece by running through a stop
/// of the group, and no more routes run on it than may stop in the group.
struct Quota {
    group: usize,
    piece: usize,
    routes: usize,
}

impl Problem {
    /// Whether any hex forbids a route entering it again, so routes' hexes are followed.
    fn tracks_reentry(&self) -> bool {
        self.no_reentry || self.no_reentry_hexes.iter().any(|&hex| hex)
    }

    fn forbids_reentry(&self, hex: usize) -> bool {
        self.no_reentry || self.no_reentry_hexes.get(hex).copied().unwrap_or(false)
    }

    fn stretch_states(&self) -> usize {
        if self.arcs.iter().all(|arc| arc.gauge == Gauge::Standard) {
            1
        } else {
            3
        }
    }

    /// Counts pieces of track that the same arcs run on as one piece: routes share one of them
    /// exactly when they share the others.
    fn merge_track(&mut self) {
        let mut arcs_on = vec![vec![]; self.resource_count];
        for (id, arc) in self.arcs.iter().enumerate() {
            for &resource in &arc.resources {
                arcs_on[resource].push(id);
            }
        }
        let mut pieces = std::collections::HashMap::new();
        let merged: Vec<Option<usize>> = arcs_on
            .into_iter()
            .map(|arcs| {
                (!arcs.is_empty()).then(|| {
                    let next = pieces.len();
                    *pieces.entry(arcs).or_insert(next)
                })
            })
            .collect();
        for arc in &mut self.arcs {
            let mut resources: Vec<usize> = arc
                .resources
                .iter()
                .filter_map(|&resource| merged[resource])
                .collect();
            resources.sort_unstable();
            resources.dedup();
            arc.resources = resources;
        }
        self.resource_count = pieces.len();
    }

    /// Gives each stop group that fewer routes may stop in than the problem has trains a piece of
    /// track of its own, after the track: first those of the groups one route or none may stop
    /// in, which two routes cannot share as they cannot share track, and then those that more
    /// routes may run on, which are counted.
    fn limit_groups(&mut self) {
        let mut limits: Vec<(usize, usize)> = self
            .group_route_limits
            .iter()
            .filter(|limit| limit.routes < self.trains.len())
            .map(|limit| (limit.routes, limit.group))
            .collect();
        limits.sort_unstable();
        for (routes, group) in limits {
            self.quotas.push(Quota {
                group,
                piece: self.resource_count,
                routes,
            });
            self.resource_count += 1;
        }
    }

    /// The first piece that more than one route may run on, where there is one.
    fn shared_from(&self) -> usize {
        self.quotas
            .iter()
            .find(|quota| quota.routes > 1)
            .map_or(usize::MAX, |quota| quota.piece)
    }

    /// By stop, the pieces of the quotas its groups are under; no stops where there are none.
    fn stop_quotas(&self) -> Vec<Vec<usize>> {
        if self.quotas.is_empty() {
            return vec![];
        }
        self.stops
            .iter()
            .map(|stop| {
                self.quotas
                    .iter()
                    .filter(|quota| stop.groups.contains(&quota.group))
                    .map(|quota| quota.piece)
                    .collect()
            })
            .collect()
    }
}

#[derive(Deserialize)]
struct Stop {
    token: bool,
    blocked: bool,
    endpoint: bool,
    allowed: bool,
    city: bool,
    town: bool,
    hex: usize,
    groups: Vec<usize>,
}

#[derive(Deserialize)]
struct Arc {
    from: Option<usize>,
    to: Option<usize>,
    next: Vec<usize>,
    resources: Vec<usize>,
    junctions: Vec<usize>,
    path: usize,
    hex: usize,
    /// A route that follows the arc to its stop ends there; the reverse arc leaves the stop freely.
    terminal: bool,
    /// The arc leaves its stop along terminus track, which a route runs on along only with one of
    /// its company's stations at or before that stop.
    #[serde(default)]
    departs_terminal: bool,
    crossings: u32,
    #[serde(default)]
    gauge: Gauge,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
enum Gauge {
    #[default]
    Standard,
    Narrow,
    Dual,
}

/// The gauge a route runs on between two stops: that of its first standard or narrow track there,
/// or either while all of it is dual. Indexes a train's crossing costs.
#[derive(Clone, Copy, PartialEq)]
enum Stretch {
    Standard = 0,
    Narrow = 1,
    Either = 2,
}

impl Stretch {
    /// The stretch of a search state, where a problem with gauges has one state per stretch gauge.
    fn of_state(state: usize, states: usize) -> Stretch {
        match state % states {
            0 => Stretch::Standard,
            1 => Stretch::Narrow,
            _ => Stretch::Either,
        }
    }

    fn state_index(self, states: usize) -> usize {
        self as usize % states
    }

    /// The stretch continued along track of the gauge, unless the gauge would change between stops.
    fn along(self, gauge: Gauge) -> Option<Stretch> {
        match (self, gauge) {
            (stretch, Gauge::Dual) => Some(stretch),
            (Stretch::Narrow, Gauge::Standard) | (Stretch::Standard, Gauge::Narrow) => None,
            (_, Gauge::Standard) => Some(Stretch::Standard),
            (_, Gauge::Narrow) => Some(Stretch::Narrow),
        }
    }
}

#[derive(Deserialize, PartialEq)]
struct Train {
    #[serde(default)]
    allowed_stops: Vec<bool>,
    #[serde(default)]
    fleet: Option<fleet::TrainPolicy>,
    id: String,
    distance: u32,
    /// What each hex side a connection crosses costs, by the connection's stretch gauge.
    crossing_costs: [u32; 3],
    requires_city: bool,
    visit_costs: Vec<u32>,
    revenues: Vec<i32>,
    first_bonus: Vec<i32>,
    #[serde(default)]
    paying_stop_limit: Option<usize>,
    /// Stops called at without counting toward the train, which pay outside the paying limit.
    #[serde(default)]
    uncounted: Vec<bool>,
    /// Tokened-out cities the train may run through on its own allowance, which pay it nothing.
    #[serde(default)]
    blocked_passes: u32,
    #[serde(default)]
    require_paying_token: bool,
    /// Bonuses count the stops from the first paid to the last, which are the route's ends.
    #[serde(default)]
    bonuses_along_route: bool,
    #[serde(default)]
    connection_bonuses: Vec<PaidConnectionBonus>,
    #[serde(default)]
    major_limit: Option<u32>,
    #[serde(default)]
    interconnections: Vec<Interconnection>,
    /// The stops the train may pass without calling at them; a passed stop neither counts toward
    /// its distance nor pays.
    #[serde(default)]
    optional: Vec<bool>,
    /// What calling at each stop pays the treasury beside the route's revenue.
    #[serde(default)]
    subsidies: Vec<i32>,
}

#[derive(Deserialize, PartialEq)]
struct PaidConnectionBonus {
    from: Vec<Option<i32>>,
    to: Vec<Option<i32>>,
    #[serde(default)]
    ends_only: bool,
    /// Stops the route must also call at, one of each mask's, for the bonus.
    #[serde(default)]
    requires: Vec<Vec<bool>>,
}

#[derive(Deserialize, PartialEq)]
struct Interconnection {
    from: Vec<usize>,
    to: Vec<usize>,
    amount: i32,
}

struct Payment<'a> {
    visits: &'a [usize],
    stops: &'a [Stop],
    destination: Option<usize>,
}

impl Train {
    fn uncounted(&self, stop: usize) -> bool {
        self.uncounted.get(stop) == Some(&true)
    }

    /// The best the route's stops pay, the paying limit choosing among the stops that count. A
    /// tokened-out city the train runs through on its own allowance pays nothing.
    fn paid_revenue(&self, payment: &Payment) -> i32 {
        let last = payment.visits.len().saturating_sub(1);
        let paying: Vec<usize> = payment
            .visits
            .iter()
            .enumerate()
            .filter(|&(index, &id)| {
                self.blocked_passes == 0
                    || index == 0
                    || index == last
                    || !payment.stops[id].blocked
            })
            .map(|(_, &id)| id)
            .collect();
        let counted: Vec<usize> = paying
            .iter()
            .copied()
            .filter(|&id| !self.uncounted(id))
            .collect();
        let count = self
            .paying_stop_limit
            .unwrap_or(counted.len())
            .min(counted.len());
        let payment = Payment {
            visits: &paying,
            ..*payment
        };
        if count == counted.len() {
            return self.selected_revenue(&payment, &paying);
        }
        let mut best = 0;
        self.select_payments(&payment, &counted, 0, count, &mut Vec::new(), &mut best);
        best
    }

    fn select_payments(
        &self,
        payment: &Payment,
        counted: &[usize],
        start: usize,
        count: usize,
        selected: &mut Vec<usize>,
        best: &mut i32,
    ) {
        if selected.len() == count {
            let paid: Vec<usize> = payment
                .visits
                .iter()
                .copied()
                .filter(|&id| self.uncounted(id) || selected.contains(&id))
                .collect();
            if !self.require_paying_token || paid.iter().any(|&id| payment.stops[id].token) {
                *best = (*best).max(self.selected_revenue(payment, &paid));
            }
            return;
        }
        for index in start..=counted.len() - (count - selected.len()) {
            selected.push(counted[index]);
            self.select_payments(payment, counted, index + 1, count, selected, best);
            selected.pop();
        }
    }

    fn selected_revenue(&self, payment: &Payment, paid: &[usize]) -> i32 {
        // Bonuses count the paid stops, or with `bonuses_along_route` every stop from the first
        // paid one to the last, which are then the route's ends.
        let (bonused, ends) = if self.bonuses_along_route && !paid.is_empty() {
            let position = |id: usize| {
                payment
                    .visits
                    .iter()
                    .position(|&visit| visit == id)
                    .unwrap()
            };
            let span = &payment.visits[position(paid[0])..=position(paid[paid.len() - 1])];
            (span, [span[0], span[span.len() - 1]])
        } else {
            (
                paid,
                [payment.visits[0], payment.visits[payment.visits.len() - 1]],
            )
        };
        let bonuses: i32 = self
            .connection_bonuses
            .iter()
            .map(|bonus| {
                if !bonus
                    .requires
                    .iter()
                    .all(|mask| bonused.iter().any(|&id| mask[id]))
                {
                    return 0;
                }
                let from = bonused.iter().filter_map(|&id| bonus.from[id]).max();
                let to = bonused
                    .iter()
                    .filter(|id| !bonus.ends_only || ends.contains(id))
                    .filter_map(|&id| bonus.to[id])
                    .max();
                match (from, to) {
                    (Some(from), Some(to)) => from + to,
                    _ => 0,
                }
            })
            .sum();
        let interconnection = payment.destination.map_or(0, |hex| {
            self.interconnections
                .iter()
                .filter(|interconnection| {
                    interconnection.to.contains(&hex)
                        && bonused
                            .iter()
                            .any(|&id| interconnection.from.contains(&payment.stops[id].hex))
                })
                .map(|interconnection| interconnection.amount)
                .max()
                .unwrap_or(0)
        });
        paid.iter().map(|&id| self.revenues[id]).sum::<i32>() + bonuses + interconnection
    }

    fn scores_payments(&self) -> bool {
        self.paying_stop_limit.is_some()
            || self.blocked_passes > 0
            || !self.connection_bonuses.is_empty()
            || !self.interconnections.is_empty()
    }

    fn majors(&self, stop: &Stop) -> u32 {
        u32::from(self.major_limit.is_some() && !stop.town)
    }

    fn optional(&self, stop: usize) -> bool {
        self.optional.get(stop) == Some(&true)
    }

    fn subsidy(&self, stop: usize) -> i32 {
        self.subsidies.get(stop).copied().unwrap_or(0)
    }

    fn calls_selectively(&self) -> bool {
        self.optional.contains(&true)
    }

    fn subsidizes(&self) -> bool {
        self.subsidies.iter().any(|&amount| amount > 0)
    }

    /// What running through the stop uses of the train's distance, when it calls there only if it
    /// chooses to.
    fn passing_cost(&self, id: usize) -> u32 {
        if self.optional(id) {
            0
        } else {
            self.visit_costs[id]
        }
    }

    fn passing_majors(&self, id: usize, stop: &Stop) -> u32 {
        if self.optional(id) {
            0
        } else {
            self.majors(stop)
        }
    }

    /// Which of the route's stops, in the order it runs them, the train calls at, given the
    /// distance its required stops and both ends use: those, and then its optional stops worth
    /// most to it, revenue and subsidy together, ties by revenue and then order, each while its
    /// distance still allows. This is the game's own choice of stops.
    fn called(
        &self,
        problem: &Problem,
        stops: &[usize],
        mut cost: u32,
        mut majors: u32,
    ) -> Vec<bool> {
        let last = stops.len() - 1;
        let mut called: Vec<bool> = (0..stops.len())
            .map(|index| index == 0 || index == last || !self.optional(stops[index]))
            .collect();
        let worth = |stop: usize| self.revenues[stop] + self.subsidy(stop);
        let mut optional: Vec<usize> = (1..last)
            .filter(|&index| !called[index] && worth(stops[index]) > 0)
            .collect();
        optional.sort_by_key(|&index| {
            (
                std::cmp::Reverse(worth(stops[index])),
                std::cmp::Reverse(self.revenues[stops[index]]),
            )
        });
        for index in optional {
            let stop = stops[index];
            let more_cost = cost + self.visit_costs[stop];
            let more_majors = majors + self.majors(&problem.stops[stop]);
            if more_cost <= self.distance
                && self.major_limit.is_none_or(|limit| more_majors <= limit)
            {
                called[index] = true;
                cost = more_cost;
                majors = more_majors;
            }
        }
        called
    }

    fn crossing_cost(&self, connection: &Connection) -> u32 {
        self.crossing_costs[connection.gauge as usize].saturating_mul(connection.crossings)
    }
}

struct Connection {
    from: usize,
    to: usize,
    paths: Vec<usize>,
    resources: Vec<usize>,
    hexes: Vec<usize>,
    first_terminal: bool,
    last_terminal: bool,
    departs_terminal: bool,
    crossings: u32,
    gauge: Stretch,
}

#[derive(Clone, Copy)]
struct Candidate {
    revenue: i32,
    visits: usize,
    offset: usize,
    extension_len: usize,
    resource_hash: u32,
    reversed: bool,
}

impl Candidate {
    fn value(&self, longest_bonus: i32) -> i32 {
        self.revenue + self.visits as i32 * longest_bonus
    }

    fn id_count(&self) -> usize {
        self.visits - 1 + self.extension_len
    }
}

enum IdArena {
    Narrow(Vec<u16>),
    Wide(Vec<usize>),
}

enum Ids<'a> {
    Narrow(std::slice::Iter<'a, u16>),
    Wide(std::slice::Iter<'a, usize>),
}

impl Iterator for Ids<'_> {
    type Item = usize;

    fn next(&mut self) -> Option<usize> {
        match self {
            Self::Narrow(ids) => ids.next().map(|&id| usize::from(id)),
            Self::Wide(ids) => ids.next().copied(),
        }
    }
}

impl IdArena {
    fn new(id_count: usize) -> Self {
        if u16::try_from(id_count.saturating_sub(1)).is_ok() {
            Self::Narrow(vec![])
        } else {
            Self::Wide(vec![])
        }
    }

    fn len(&self) -> usize {
        match self {
            Self::Narrow(ids) => ids.len(),
            Self::Wide(ids) => ids.len(),
        }
    }

    fn capacity(&self) -> usize {
        match self {
            Self::Narrow(ids) => ids.capacity(),
            Self::Wide(ids) => ids.capacity(),
        }
    }

    fn id_bytes(&self) -> usize {
        match self {
            Self::Narrow(_) => std::mem::size_of::<u16>(),
            Self::Wide(_) => std::mem::size_of::<usize>(),
        }
    }

    fn reserve(&mut self, capacity: usize) {
        match self {
            Self::Narrow(ids) => ids.reserve_exact(capacity - ids.len()),
            Self::Wide(ids) => ids.reserve_exact(capacity - ids.len()),
        }
    }

    fn extend(&mut self, added: &[usize]) {
        match self {
            Self::Narrow(ids) => ids.extend(added.iter().map(|&id| {
                u16::try_from(id).expect("candidate id must fit the network's arena width")
            })),
            Self::Wide(ids) => ids.extend_from_slice(added),
        }
    }

    fn ids(&self, range: std::ops::Range<usize>) -> Ids<'_> {
        match self {
            Self::Narrow(ids) => Ids::Narrow(ids[range].iter()),
            Self::Wide(ids) => Ids::Wide(ids[range].iter()),
        }
    }

    fn any(&self, range: std::ops::Range<usize>, mut predicate: impl FnMut(usize) -> bool) -> bool {
        match self {
            Self::Narrow(ids) => ids[range].iter().any(|&id| predicate(usize::from(id))),
            Self::Wide(ids) => ids[range].iter().any(|&id| predicate(id)),
        }
    }

    fn copy_within(&mut self, range: std::ops::Range<usize>, destination: usize) {
        match self {
            Self::Narrow(ids) => ids.copy_within(range, destination),
            Self::Wide(ids) => ids.copy_within(range, destination),
        }
    }

    fn truncate(&mut self, len: usize) {
        match self {
            Self::Narrow(ids) => ids.truncate(len),
            Self::Wide(ids) => ids.truncate(len),
        }
    }

    fn shrink_to_fit(&mut self) {
        match self {
            Self::Narrow(ids) => ids.shrink_to_fit(),
            Self::Wide(ids) => ids.shrink_to_fit(),
        }
    }
}

struct Candidates {
    entries: Vec<Candidate>,
    arena: IdArena,
}

impl std::ops::Deref for Candidates {
    type Target = [Candidate];

    fn deref(&self) -> &[Candidate] {
        &self.entries
    }
}

const ALLOCATION: usize = 16;

fn grown_capacity(capacity: usize, required: usize) -> usize {
    if required > capacity {
        required.max(capacity + capacity / 2).max(4)
    } else {
        capacity
    }
}

impl Candidates {
    fn new(network: Network<'_>) -> Self {
        Self {
            entries: vec![],
            arena: IdArena::new(network.connections.len().max(network.problem.arcs.len())),
        }
    }

    fn connection_ids(&self, candidate: &Candidate) -> Ids<'_> {
        self.arena
            .ids(candidate.offset..candidate.offset + candidate.visits - 1)
    }

    fn extension_ids(&self, candidate: &Candidate) -> Ids<'_> {
        let start = candidate.offset + candidate.visits - 1;
        self.arena.ids(start..start + candidate.extension_len)
    }

    /// The pieces the route runs on: its track, and the quotas of its stops. A connection runs
    /// on the quotas of the stop it reaches, which leaves those of the route's first stop.
    fn resources<'a>(
        &'a self,
        candidate: &Candidate,
        network: Network<'a>,
    ) -> impl Iterator<Item = usize> + use<'a> {
        self.first_quotas(candidate, network)
            .iter()
            .copied()
            .chain(
                self.connection_ids(candidate)
                    .flat_map(move |id| network.connections[id].resources.iter().copied()),
            )
            .chain(
                self.extension_ids(candidate)
                    .flat_map(move |id| network.problem.arcs[id].resources.iter().copied()),
            )
    }

    /// The quotas of the stop the route was walked from.
    fn first_quotas<'a>(&self, candidate: &Candidate, network: Network<'a>) -> &'a [usize] {
        if network.quotas.is_empty() {
            return &[];
        }
        self.connection_ids(candidate)
            .next()
            .map_or(&[], |id| network.quotas_at(network.connections[id].from))
    }

    /// The quotas of the route's stops.
    fn quotas<'a>(
        &'a self,
        candidate: &Candidate,
        network: Network<'a>,
    ) -> impl Iterator<Item = usize> + use<'a> {
        self.first_quotas(candidate, network).iter().copied().chain(
            self.connection_ids(candidate).flat_map(move |id| {
                network
                    .quotas_at(network.connections[id].to)
                    .iter()
                    .copied()
            }),
        )
    }

    fn resource_bits(&self, candidate: &Candidate, network: Network<'_>, bits: &mut [u64]) {
        bits.fill(0);
        self.resources(candidate, network)
            .for_each(|resource| bits[resource / 64] |= 1 << (resource % 64));
    }

    fn route(&self, id: usize, train: usize, network: Network<'_>) -> Route {
        let candidate = &self[id];
        network.route(
            train,
            candidate.reversed,
            self.connection_ids(candidate),
            self.extension_ids(candidate),
        )
    }

    /// The stored route as one kept apart from the lists.
    fn lone(&self, id: usize, train: usize, network: Network<'_>) -> Lone {
        let candidate = &self[id];
        let mut track = vec![0; network.problem.resource_count.div_ceil(64)];
        self.resource_bits(candidate, network, &mut track);
        Lone {
            revenue: candidate.revenue,
            visits: candidate.visits,
            track,
            route: self.route(id, train, network),
        }
    }

    /// The first stored route clear of the closed track and worth more than the floor, of routes
    /// stored the most valuable first.
    fn clear_of(
        &self,
        closed: &[u64],
        floor: i32,
        train: usize,
        network: Network<'_>,
    ) -> Option<Lone> {
        let shut = |resource: usize| {
            closed
                .get(resource / 64)
                .is_some_and(|word| word >> (resource % 64) & 1 == 1)
        };
        let id = self
            .iter()
            .take_while(|candidate| candidate.revenue > floor)
            .position(|candidate| !self.resources(candidate, network).any(shut))?;
        Some(self.lone(id, train, network))
    }

    /// Puts the routes in the order they are paired in, the most valuable first.
    fn rank(&mut self) {
        self.entries
            .sort_unstable_by_key(|candidate| std::cmp::Reverse(candidate.revenue));
    }

    /// Puts the most valuable so many of the routes first, in that order.
    fn rank_leading(&mut self, leading: usize) {
        let worth = |candidate: &Candidate| std::cmp::Reverse(candidate.revenue);
        if leading < self.len() {
            self.entries.select_nth_unstable_by_key(leading, worth);
        }
        let leading = leading.min(self.len());
        self.entries[..leading].sort_unstable_by_key(worth);
    }

    /// Keeps only the routes worth more than the floor.
    fn keep_above(&mut self, floor: i32, longest_bonus: i32) {
        self.entries
            .retain(|candidate| candidate.value(longest_bonus) > floor);
        self.compact();
    }

    fn bytes(&self, selection_bytes: usize) -> usize {
        std::mem::size_of::<Self>()
            + 2 * std::mem::size_of::<usize>()
            + 3 * ALLOCATION
            + self.entries.capacity() * std::mem::size_of::<Candidate>()
            + self.arena.capacity() * self.arena.id_bytes()
            + self.len() * selection_bytes
    }

    fn dedup_bytes(resource_count: usize) -> usize {
        2 * (resource_count.div_ceil(64) * std::mem::size_of::<u64>() + ALLOCATION)
    }

    fn growth_peak(&self, ids: usize, selection_bytes: usize, resource_count: usize) -> usize {
        let header = std::mem::size_of::<Candidate>();
        let entries = grown_capacity(self.entries.capacity(), self.len() + 1);
        let arena = grown_capacity(self.arena.capacity(), self.arena.len() + ids);
        let entry_growth = (entries - self.entries.capacity()) * header;
        let arena_growth = (arena - self.arena.capacity()) * self.arena.id_bytes();
        let entry_peak = if entry_growth > 0 {
            entries * header + ALLOCATION
        } else {
            0
        };
        let arena_peak = if arena_growth > 0 {
            arena * self.arena.id_bytes() + ALLOCATION
        } else {
            0
        };
        self.bytes(selection_bytes)
            + selection_bytes
            + entry_peak
                .max(entry_growth + arena_peak)
                .max(entry_growth + arena_growth + Self::dedup_bytes(resource_count))
    }

    fn push(&mut self, candidate: CandidateView<'_>) {
        debug_assert_eq!(candidate.visits, candidate.connections.len() + 1);
        let entries = grown_capacity(self.entries.capacity(), self.len() + 1);
        let arena = grown_capacity(
            self.arena.capacity(),
            self.arena.len() + candidate.connections.len() + candidate.extension.len(),
        );
        self.entries.reserve_exact(entries - self.len());
        self.arena.reserve(arena);
        let offset = self.arena.len();
        self.arena.extend(candidate.connections);
        self.arena.extend(candidate.extension);
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        candidate.resources.hash(&mut hash);
        self.entries.push(Candidate {
            resource_hash: hash.finish() as u32,
            revenue: candidate.revenue,
            visits: candidate.visits,
            offset,
            extension_len: candidate.extension.len(),
            reversed: candidate.reversed,
        });
    }

    fn compact(&mut self) {
        self.entries
            .sort_unstable_by_key(|candidate| candidate.offset);
        let mut end = 0;
        for candidate in &mut self.entries {
            let len = candidate.id_count();
            self.arena
                .copy_within(candidate.offset..candidate.offset + len, end);
            candidate.offset = end;
            end += len;
        }
        self.arena.truncate(end);
    }

    fn shrink(&mut self, selection_bytes: usize, budget: usize) {
        let extra = (self.len() * std::mem::size_of::<Candidate>())
            .max(self.arena.len() * self.arena.id_bytes())
            + ALLOCATION;
        if self.bytes(selection_bytes) + extra <= budget {
            self.entries.shrink_to_fit();
            self.arena.shrink_to_fit();
        }
    }

    fn dedup(&mut self, network: Network<'_>) {
        if network.problem.fleet.is_some() {
            return;
        }
        self.dedup_by_hash(network, |candidate| candidate.resource_hash);
    }

    fn dedup_by_hash(&mut self, network: Network<'_>, hash: impl Fn(&Candidate) -> u32) {
        if self.len() < 2 {
            return;
        }
        let key = |candidate: &Candidate| {
            (
                hash(candidate),
                if network.problem.longest_route_bonus_per_stop > 0 {
                    candidate.visits
                } else {
                    0
                },
            )
        };
        self.entries.sort_unstable_by_key(|candidate| {
            (key(candidate), std::cmp::Reverse(candidate.revenue))
        });
        let mut bits = vec![0; network.problem.resource_count.div_ceil(64)];
        let mut other = vec![0; bits.len()];
        let mut start = 0;
        for index in 1..self.len() {
            if key(&self[start]) != key(&self[index]) {
                start = index;
                continue;
            }
            self.resource_bits(&self[index], network, &mut bits);
            for kept in start..index {
                if self[kept].offset == UNREACHED {
                    continue;
                }
                self.resource_bits(&self[kept], network, &mut other);
                if bits == other {
                    self.entries[index].offset = UNREACHED;
                    break;
                }
            }
        }
        self.entries
            .retain(|candidate| candidate.offset != UNREACHED);
        self.compact();
    }
}

struct CandidateView<'a> {
    revenue: i32,
    visits: usize,
    connections: &'a [usize],
    resources: &'a [u64],
    reversed: bool,
    extension: &'a [usize],
}

#[derive(Serialize)]
pub struct Solution {
    revenue: i32,
    subsidy: i32,
    routes: Vec<Route>,
    exhaustive: bool,
    path_exhaustive: bool,
    combination_exhaustive: bool,
    candidates: Vec<usize>,
    memory_limited: bool,
    expansions: u64,
    connections: usize,
    compile_ms: f64,
    path_ms: f64,
    combination_ms: f64,
}

#[derive(Serialize, Clone)]
struct Route {
    train: usize,
    connections: Vec<RouteConnection>,
    extension: Vec<usize>,
}

#[derive(Serialize, Clone)]
struct RouteConnection {
    from: usize,
    to: usize,
    paths: Vec<usize>,
}

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "clock")]
unsafe extern "C" {
    fn now() -> f64;
}

fn milliseconds() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        unsafe { now() }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        static START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
        START
            .get_or_init(std::time::Instant::now)
            .elapsed()
            .as_secs_f64()
            * 1000.0
    }
}

fn validate(problem: &Problem) -> Result<(), String> {
    let n = problem.stops.len();
    if problem.version != 12
        || !problem.budget_ms.is_finite()
        || problem.budget_ms <= 0.0
        || problem
            .pace_ms
            .is_some_and(|pace| !pace.is_finite() || pace <= 0.0)
        || problem.memory_budget_bytes == 0
    {
        return Err("Unsupported problem version or budget".into());
    }
    if !problem.no_reentry_hexes.is_empty()
        && problem.no_reentry_hexes.len() != problem.hex_bonuses.len()
    {
        return Err("Invalid re-entry hexes".into());
    }
    for stop in &problem.stops {
        if stop.groups.iter().any(|&g| g >= problem.group_count)
            || stop.hex >= problem.hex_bonuses.len()
        {
            return Err("Invalid stop cost or group".into());
        }
    }
    for arc in &problem.arcs {
        if arc.from.is_some_and(|s| s >= n)
            || arc.to.is_some_and(|s| s >= n)
            || arc.next.iter().any(|&a| a >= problem.arcs.len())
            || arc.resources.iter().any(|&r| r >= problem.resource_count)
            || arc.junctions.iter().any(|&j| j >= problem.junction_count)
            || arc.hex >= problem.hex_bonuses.len()
            || arc.resources.is_empty()
        {
            return Err("Invalid track reference".into());
        }
    }
    if !problem.arcs.len().is_multiple_of(2) {
        return Err("Track arcs must occur in reverse pairs".into());
    }
    for (id, arc) in problem.arcs.iter().enumerate() {
        let reverse = &problem.arcs[id ^ 1];
        if arc.from != reverse.to
            || arc.to != reverse.from
            || arc.resources != reverse.resources
            || arc.junctions != reverse.junctions
            || arc.path != reverse.path
            || arc.hex != reverse.hex
            || arc
                .next
                .iter()
                .any(|&next| !problem.arcs[next ^ 1].next.contains(&(id ^ 1)))
        {
            return Err("Track connectivity must be reversible".into());
        }
    }
    for train in &problem.trains {
        if (!train.allowed_stops.is_empty() && train.allowed_stops.len() != n)
            || train.visit_costs.len() != n
            || train.paying_stop_limit == Some(0)
            || train.connection_bonuses.iter().any(|bonus| {
                bonus.from.len() != n
                    || bonus.to.len() != n
                    || bonus.requires.iter().any(|mask| mask.len() != n)
                    || bonus
                        .from
                        .iter()
                        .chain(&bonus.to)
                        .flatten()
                        .any(|&amount| amount < 0)
            })
            || train.revenues.len() != n
            || train.interconnections.iter().any(|interconnection| {
                interconnection.amount < 0
                    || interconnection
                        .from
                        .iter()
                        .chain(&interconnection.to)
                        .any(|&hex| hex >= problem.hex_bonuses.len())
            })
            || train.first_bonus.len() != n
            || (!train.optional.is_empty() && train.optional.len() != n)
            || (!train.uncounted.is_empty() && train.uncounted.len() != n)
            || (!train.subsidies.is_empty() && train.subsidies.len() != n)
            || train
                .revenues
                .iter()
                .chain(&train.first_bonus)
                .chain(&train.subsidies)
                .any(|&r| r < 0)
        {
            return Err("Unsupported train revenue profile".into());
        }
    }
    // A negative hex bonus is a charge, as 1880's ferry fee; it only lowers a route's revenue.
    if problem.longest_route_bonus_per_stop < 0 {
        return Err("Negative longest-route bonus".into());
    }
    if problem
        .group_route_limits
        .iter()
        .any(|limit| limit.group >= problem.group_count)
    {
        return Err("Invalid stop group limit".into());
    }
    // A fleet's selection counts no routes into a stop group.
    if problem.fleet.is_some() && !problem.group_route_limits.is_empty() {
        return Err("Stop group limits are not supported with a fleet policy".into());
    }
    // Only a fleet's selection weighs subsidies and counts blocked passes across its routes.
    if problem.fleet.is_none()
        && (problem.trains.iter().any(Train::subsidizes)
            || (problem.blocked_passes > 0 && problem.trains.len() > 1))
    {
        return Err("Stop subsidies and shared blocked passes require a fleet policy".into());
    }
    fleet::validate(problem)
}

/// How far a search may go: to a time, and to a count of the steps the solve's searches have
/// taken together. Stages limited by steps end at the same place on any machine fast enough to
/// reach it in time, so the solve takes the same course there.
#[derive(Clone, Copy)]
struct Limit {
    deadline: f64,
    steps: u64,
}

impl Limit {
    fn until(deadline: f64) -> Self {
        Self {
            deadline,
            steps: u64::MAX,
        }
    }

    fn reached(self, taken: u64) -> bool {
        taken >= self.steps || milliseconds() >= self.deadline
    }

    /// An even part of what is left to the limit, of so many parts.
    fn part(self, taken: u64, parts: usize) -> Self {
        let now = milliseconds();
        Self {
            deadline: now + (self.deadline - now).max(0.0) / parts as f64,
            steps: taken.saturating_add(self.steps.saturating_sub(taken) / parts as u64),
        }
    }

    /// The limit at this share of the way to it from the start.
    fn shortened(self, started: f64, share: f64) -> Self {
        Self {
            deadline: started + (self.deadline - started) * share,
            steps: if self.steps == u64::MAX {
                u64::MAX
            } else {
                (self.steps as f64 * share) as u64
            },
        }
    }

    /// So many steps on from those taken, and no later than the limit.
    fn steps_on(self, taken: u64, steps: u64) -> Self {
        Self {
            deadline: self.deadline,
            steps: self.steps.min(taken.saturating_add(steps)),
        }
    }
}

/// Where a listing of a train's routes stopped: the start it was walking from, and the place of
/// the connection taken at each stop of the route it had reached, the last stop first.
#[derive(Default)]
struct Resume {
    start: usize,
    path: Vec<usize>,
}

struct Compiler<'a> {
    problem: &'a Problem,
    quotas: &'a [Vec<usize>],
    used: Vec<bool>,
    junction_segments: Vec<u8>,
    walking: Vec<usize>,
    connections: Vec<Connection>,
    /// The hexes each connection runs through in turn, when routes may not enter a hex again.
    stays: Vec<Vec<usize>>,
    deadline: f64,
    expansions: u64,
    exhausted: bool,
    // Bytes the connections and their adjacency entries may take before compilation stops.
    memory_budget: usize,
    stored_bytes: usize,
    limited: bool,
}

impl Compiler<'_> {
    /// The hexes the track walked runs through in turn, when routes may not enter a hex again;
    /// none when it enters one again itself.
    fn stays(&self) -> Option<Vec<usize>> {
        let mut stays = vec![];
        if self.problem.tracks_reentry() {
            for &a in &self.walking {
                let hex = self.problem.arcs[a].hex;
                if stays.last() == Some(&hex) {
                    continue;
                }
                if stays.contains(&hex) && self.problem.forbids_reentry(hex) {
                    return None;
                }
                stays.push(hex);
            }
        }
        Some(stays)
    }

    fn walk(&mut self, from: usize, arc_id: usize, stretch: Stretch) {
        self.expansions += 1;
        if self.exhausted
            || (self.expansions == 1 || self.expansions.is_multiple_of(4096))
                && milliseconds() > self.deadline
        {
            self.exhausted = true;
            return;
        }
        let arc = &self.problem.arcs[arc_id];
        let Some(stretch) = stretch.along(arc.gauge) else {
            return;
        };
        if arc.resources.iter().any(|&r| self.used[r])
            || arc
                .junctions
                .iter()
                .any(|&j| self.junction_segments[j] >= 2)
        {
            return;
        }
        for &r in &arc.resources {
            self.used[r] = true;
        }
        for &j in &arc.junctions {
            self.junction_segments[j] += 1;
        }
        self.walking.push(arc_id);
        if let Some(to) = arc.to {
            if from != to && self.problem.stops[to].allowed {
                let interior_terminal = self
                    .walking
                    .iter()
                    .skip(1)
                    .take(self.walking.len().saturating_sub(2))
                    .any(|&a| self.problem.arcs[a].terminal);
                if !interior_terminal && let Some(stays) = self.stays() {
                    let mut resources: Vec<_> = self
                        .walking
                        .iter()
                        .flat_map(|&a| self.problem.arcs[a].resources.iter().copied())
                        .collect();
                    resources.sort_unstable();
                    resources.dedup();
                    if let Some(quotas) = self.quotas.get(to) {
                        resources.extend(quotas);
                    }
                    let mut hexes: Vec<_> = self
                        .walking
                        .iter()
                        .map(|&a| self.problem.arcs[a].hex)
                        .filter(|&h| self.problem.hex_bonuses[h] != 0)
                        .collect();
                    hexes.sort_unstable();
                    hexes.dedup();
                    let connection = Connection {
                        from,
                        to,
                        resources,
                        hexes,
                        paths: self
                            .walking
                            .iter()
                            .map(|&a| self.problem.arcs[a].path)
                            .collect(),
                        first_terminal: self.problem.arcs[self.walking[0]].terminal,
                        last_terminal: arc.terminal,
                        departs_terminal: self.problem.arcs[self.walking[0]].departs_terminal,
                        crossings: self
                            .walking
                            .iter()
                            .map(|&a| self.problem.arcs[a].crossings)
                            .sum(),
                        gauge: stretch,
                    };
                    let bytes = connection_bytes(&connection)
                        + if stays.is_empty() {
                            0
                        } else {
                            std::mem::size_of::<Vec<usize>>()
                                + stays.len() * std::mem::size_of::<usize>()
                                + ALLOCATION
                        };
                    let grown = if self.connections.len() == self.connections.capacity() {
                        self.connections.capacity().max(4) * std::mem::size_of::<Connection>()
                    } else {
                        0
                    };
                    if self.stored_bytes + bytes + grown > self.memory_budget {
                        self.limited = true;
                        self.exhausted = true;
                    } else {
                        self.stored_bytes += bytes + grown;
                        self.connections.push(connection);
                        if self.problem.tracks_reentry() {
                            self.stays.push(stays);
                        }
                    }
                }
            }
        } else {
            for &next in &arc.next {
                self.walk(from, next, stretch);
            }
        }
        self.walking.pop();
        for &j in &arc.junctions {
            self.junction_segments[j] -= 1;
        }
        for &r in &arc.resources {
            self.used[r] = false;
        }
    }
}

#[derive(Clone, Copy)]
struct RouteValue {
    cost: u32,
    // Cities and towns visited.
    places: u32,
    majors: u32,
    revenue: i32,
    token: bool,
    city: bool,
    first_bonus: i32,
    last_bonus: i32,
    // Blocked cities and towns run through.
    passes: u32,
    // What the hexes run through have added to the revenue.
    collected: i32,
    // What the blocked stops run through on the train's own allowance would have paid.
    unpaid: i32,
}

struct Search<'a> {
    problem: &'a Problem,
    connections: &'a [Connection],
    stays: &'a [Vec<usize>],
    adjacency: &'a [Vec<usize>],
    departures: &'a [Vec<usize>],
    quotas: &'a [Vec<usize>],
    train: &'a Train,
    profile: Rc<Profile>,
    origins: Vec<bool>,
    destinations: Vec<bool>,
    extension_parents: Vec<usize>,
    // Search states per arc for extensions: one for each stretch gauge where track has gauges.
    stretch_states: usize,
    used: Vec<u64>,
    visited: Vec<bool>,
    groups: Vec<bool>,
    hexes: Vec<u32>,
    // The hexes the route has been in, when it may not enter one again.
    been: Vec<bool>,
    walking: Vec<usize>,
    // Every stop uses some of the train's capacity, so a full train cannot continue.
    every_stop_costs: bool,
    candidates: Candidates,
    streaming: Option<StreamingSelection<'a>>,
    count: usize,
    expansions: u64,
    best_only: bool,
    deadline: f64,
    // The steps the search may take, and the steps the solve's searches took before it. A stop
    // with many connections on takes more than a step to walk on from, and pairing a streamed
    // route takes steps too: the stream had looked at so many stored routes before.
    steps: u64,
    taken: &'a std::cell::Cell<u64>,
    stepped: u64,
    weighed: u64,
    scanned: u64,
    exhausted: bool,
    // A listing taken up where an earlier one stopped follows that one's route first; one that
    // stops keeps where, the same way.
    resume: Vec<usize>,
    cut: Resume,
    // What the listing does when its routes fill the memory, and whether it stopped for that.
    when_full: WhenFull,
    full: bool,
    // By place in a streamed route, where among the stored routes the partner search of the
    // route as far as that place came to: every stored route before shares track with it, and
    // so with any route on from it. The places up to `sought` have had their search; the track
    // of the route as far as each place is kept for the search of those that have not.
    partners: Vec<usize>,
    sought: usize,
    tracks: Vec<u64>,
    // By place in a streamed route, the most a stored route clear of the route so far is worth,
    // by the pieces of track taken one at a time.
    caps: Vec<i32>,
    // Bytes the stored candidates may take, counting their share of the selection's tables.
    memory_budget: usize,
    selection_bytes_per_candidate: usize,
    // Once the budget is reached, only candidates worth more than the weakest one kept are stored.
    floor: Option<i32>,
    limited: bool,
    // The most valuable route the train can run (0 when it has none), once the search has finished.
    max_value: i32,
    alike: Option<alike::Alike>,
    // What the hexes the route has not run through could still add.
    bonus_left: i32,
    amounts: Vec<i32>,
    // The current stretch of the search, and the routes the bound cut in it.
    stretch: u64,
    cuts: u64,
    // By place in the route, the moves on from its stop that run on track already in use.
    shut: Vec<Vec<u64>>,
    // Every stop the train calls at pays it, and nothing but its stops and hexes does.
    plain: bool,
}

const UNREACHED: usize = usize::MAX;
const EXTENSION_ROOT: usize = usize::MAX - 1;

impl<'a> Search<'a> {
    fn walk(&mut self, order: Option<&alike::Order>, start: usize, node: usize, value: RouteValue) {
        let RouteValue {
            cost,
            places,
            majors,
            revenue,
            token,
            city,
            first_bonus,
            last_bonus,
            passes,
            unpaid,
            ..
        } = value;
        self.expansions += 1;
        // The way back to where an earlier listing stopped takes none of the steps: a listing
        // given fewer than that way is long still goes on from there.
        let returning = !self.resume.is_empty();
        self.stepped += u64::from(!returning);
        if self.exhausted
            || !returning && self.steps_taken() > self.steps
            || (self.expansions == 1 || self.expansions.is_multiple_of(4096))
                && milliseconds() > self.deadline
        {
            self.exhausted = true;
            return;
        }
        let depth = self.walking.len();
        self.partners[depth] = depth
            .checked_sub(1)
            .map_or(0, |before| self.partners[before]);
        self.sought = self.sought.min(depth);
        let stop = &self.problem.stops[node];
        if self.train.allowed_stops.get(node) == Some(&false)
            || cost > self.train.distance
            || self.train.major_limit.is_some_and(|limit| majors > limit)
        {
            return;
        }
        let token = token || stop.token;
        let city = city || stop.city;
        let places = places + u32::from(stop.city || stop.town);
        if !token && self.profile.token_distance[node] > self.train.distance - cost {
            return;
        }
        // Through the few leading routes of an unfinished list, a streamed route's partner
        // search is run for every stop it comes to: one with no stored route clear of it goes
        // no further.
        if depth > 0
            && self.sought == depth
            && let Some(streaming) = &mut self.streaming
            && streaming.few()
        {
            let words = self.used.len();
            let track = &self.tracks[depth * words..(depth + 1) * words];
            self.partners[depth] = streaming.first_clear(self.partners[depth], track, i32::MAX, 0);
            self.sought = depth + 1;
        }
        // An optional stop pays only once the route is known to call there.
        let revenue = if node == start || !self.train.optional(node) {
            revenue + self.train.revenues[node]
        } else {
            revenue
        };
        let bonus = self.train.first_bonus[node];
        let first_bonus = if first_bonus != 0 { first_bonus } else { bonus };
        let last_bonus = if bonus != 0 { bonus } else { last_bonus };
        // Each route is kept from one of its ends; one that ends across a link of terminus track
        // is walked only towards the link.
        let across_link = self.walking.len() > 1
            && self.walking.last().is_some_and(|&id| {
                let arrival = &self.connections[id];
                arrival.last_terminal && arrival.departs_terminal
            });
        if (node > start || across_link)
            && token
            && stop.endpoint
            && (!self.train.requires_city || city)
            && places >= self.problem.minimum_cities_and_towns
        {
            self.record(
                start,
                node,
                RouteValue {
                    revenue,
                    first_bonus,
                    last_bonus,
                    ..value
                },
            );
        }
        let passable = (stop.city || stop.town)
            && passes < self.problem.blocked_passes + self.train.blocked_passes;
        if !self.walking.is_empty()
            && (stop.blocked && !passable
                || (self.connections[*self.walking.last().unwrap()].last_terminal
                    && !(self.walking.len() == 1
                        && self.connections[self.walking[0]].paths.len() == 1)))
        {
            return;
        }
        let passed = !self.walking.is_empty() && stop.blocked;
        let onward = RouteValue {
            places,
            revenue,
            token,
            city,
            first_bonus,
            last_bonus,
            passes: passes + u32::from(passed),
            unpaid: if passed && self.train.blocked_passes > 0 {
                unpaid + self.train.revenues[node]
            } else {
                unpaid
            },
            ..value
        };
        self.visited[node] = true;
        for &g in &stop.groups {
            self.groups[g] = true;
        }
        // A full train goes no further unless some stop is free to visit.
        if !(cost == self.train.distance && self.every_stop_costs) {
            let further = self.continues(start, node, onward);
            if !matches!(further, outlook::Onward::Ended) {
                match order {
                    Some(order) => self.branch(order, start, node, onward, further),
                    None => self.list(start, node, onward, further),
                }
            }
        }
        for &g in &stop.groups {
            self.groups[g] = false;
        }
        self.visited[node] = false;
    }

    /// The steps the search has taken: the stops walked to, and for a stream the stored routes
    /// looked at for partners.
    fn steps_taken(&self) -> u64 {
        let scans = self
            .streaming
            .as_ref()
            .map_or(0, |stream| stream.scans - self.scanned);
        self.stepped + self.weighed + scans / SCANS_PER_STEP
    }

    /// Runs on from the stop along every connection, to list every route.
    fn list(&mut self, start: usize, node: usize, value: RouteValue, further: outlook::Onward) {
        let (problem, train, adjacency) = (self.problem, self.train, self.adjacency);
        let leaving = !self.walking.is_empty();
        let from = self.resume.pop();
        if from.is_none() {
            self.weighed += adjacency[node].len() as u64 / MOVES_PER_STEP;
        }
        for (place, &connection) in adjacency[node].iter().enumerate().skip(from.unwrap_or(0)) {
            // What an earlier listing left of its route lay beyond its connection here.
            if from.is_some_and(|from| place > from) {
                self.resume.clear();
            }
            let edge = &self.connections[connection];
            let next = &problem.stops[edge.to];
            // The step the next call would reject at once, checked first and before touching any
            // state.
            let next_cost = value.cost + train.passing_cost(edge.to) + train.crossing_cost(edge);
            let next_majors = value.majors + train.passing_majors(edge.to, next);
            if next_cost > train.distance
                || train.major_limit.is_some_and(|limit| next_majors > limit)
                || !(value.token || next.token)
                    && self.profile.token_distance[edge.to] > train.distance - next_cost
            {
                continue;
            }
            if self.visited[edge.to]
                || next.groups.iter().any(|&g| self.groups[g])
                || edge.first_terminal && leaving && edge.paths.len() > 1
                || edge.departs_terminal && leaving && !value.token
                || !self.worth_taking(start, connection, next_cost, value, further)
                || edge
                    .resources
                    .iter()
                    .any(|&r| self.used[r / 64] & (1 << (r % 64)) != 0)
            {
                continue;
            }
            let entered = self.entered(start, connection);
            if entered
                .iter()
                .any(|&hex| self.been[hex] && problem.forbids_reentry(hex))
            {
                continue;
            }
            self.advance(
                None,
                start,
                connection,
                entered,
                (next_cost, next_majors),
                value,
            );
            if self.exhausted {
                self.cut.path.push(place);
                break;
            }
        }
    }

    /// Takes the connection and walks on from the stop it reaches.
    #[inline(always)]
    fn advance(
        &mut self,
        order: Option<&alike::Order>,
        start: usize,
        connection: usize,
        entered: &[usize],
        (cost, majors): (u32, u32),
        value: RouteValue,
    ) {
        let problem = self.problem;
        let edge = &self.connections[connection];
        for &hex in entered {
            self.been[hex] = true;
        }
        for &r in &edge.resources {
            self.used[r / 64] |= 1 << (r % 64);
        }
        let mut extra = 0;
        let bonus_left = self.bonus_left;
        for &h in &edge.hexes {
            if self.hexes[h] == 0 {
                extra += problem.hex_bonuses[h];
                self.bonus_left -= problem.hex_bonuses[h].max(0);
            }
            self.hexes[h] += 1;
        }
        self.walking.push(connection);
        if let Some(streaming) = &self.streaming {
            let depth = self.walking.len();
            let words = self.used.len();
            let at = depth * words;
            if self.tracks.len() < at + words {
                self.tracks.resize(at + words, 0);
            }
            self.tracks[at..at + words].copy_from_slice(&self.used);
            self.caps[depth] = self.caps[depth - 1].min(streaming.clear_of(connection));
        }
        self.walk(
            order,
            start,
            edge.to,
            RouteValue {
                cost,
                majors,
                revenue: value.revenue + extra,
                collected: value.collected + extra,
                ..value
            },
        );
        self.walking.pop();
        self.bonus_left = bonus_left;
        for &hex in entered {
            self.been[hex] = false;
        }
        for &h in &edge.hexes {
            self.hexes[h] -= 1;
        }
        for &r in &edge.resources {
            self.used[r / 64] &= !(1 << (r % 64));
        }
    }

    /// Runs on from the stop for the one best route: along the connections that pay most first,
    /// and not along one that differs from one already walked only in track nothing needed.
    fn branch(
        &mut self,
        order: &alike::Order,
        start: usize,
        node: usize,
        value: RouteValue,
        further: outlook::Onward,
    ) {
        let (problem, train, connections) = (self.problem, self.train, self.connections);
        let depth = self.walking.len();
        self.weighed += order.moves[node].len() as u64 / MOVES_PER_STEP;
        if let Some(alike) = &mut self.alike {
            alike.arrive(depth);
        }
        let mut shut = std::mem::take(&mut self.shut[depth]);
        shut.clear();
        shut.resize(order.words(node), 0);
        let moves = &order.moves[node];
        let mut index = 0;
        while let Some(&step) = moves.get(index) {
            if shut
                .get(index / 64)
                .is_some_and(|shut| shut >> (index % 64) & 1 == 1)
            {
                index += 1;
                continue;
            }
            let edge = &connections[step.connection];
            let next = &problem.stops[edge.to];
            if self.visited[edge.to] || next.groups.iter().any(|&g| self.groups[g]) {
                index = step.stop_end;
                continue;
            }
            // The step the next call would reject at once, checked first and before touching any
            // state.
            let next_cost = value.cost + train.passing_cost(edge.to) + train.crossing_cost(edge);
            let next_majors = value.majors + train.passing_majors(edge.to, next);
            if next_cost > train.distance
                || train.major_limit.is_some_and(|limit| next_majors > limit)
                || !(value.token || next.token)
                    && self.profile.token_distance[edge.to] > train.distance - next_cost
                || edge.first_terminal && depth > 0 && edge.paths.len() > 1
                || edge.departs_terminal && depth > 0 && !value.token
                || !self.worth_taking(start, step.connection, next_cost, value, further)
                || self
                    .alike
                    .as_mut()
                    .is_some_and(|alike| alike.class_covered(depth, edge.to, step.class))
            {
                index = step.class_end;
                continue;
            }
            let uses = |r: &usize| self.used[r / 64] & (1 << (r % 64)) != 0;
            // The way out of the stop is shared by a run of connections: in use, or not what
            // the arrival here needs, for all of them at once.
            let own = order.own(step.connection);
            if let Some(&r) = own.iter().chain(&edge.resources).find(|r| uses(r)) {
                if let Some(alike) = &mut self.alike {
                    alike.blocked_by(r);
                }
                for (shut, users) in shut.iter_mut().zip(order.users(node, r)) {
                    *shut |= users;
                }
                index += 1;
                continue;
            }
            if self
                .alike
                .as_ref()
                .is_some_and(|alike| !alike.meets_needs(depth, own))
            {
                index = step.run_end;
                continue;
            }
            index += 1;
            let entered = self.entered(start, step.connection);
            let reenters = |hex: &usize| self.been[*hex] && problem.forbids_reentry(*hex);
            let mut narrowed = false;
            if let Some(alike) = &mut self.alike {
                if let Some(&hex) = entered.iter().find(|hex| reenters(hex)) {
                    alike.closed_by(hex);
                    continue;
                }
                match alike.verdict(depth, edge, step.class) {
                    alike::Verdict::Covered => continue,
                    alike::Verdict::Walk { narrowed: only } => narrowed = only,
                }
                alike.take(depth, edge, entered);
            } else if entered.iter().any(reenters) {
                continue;
            }
            self.advance(
                Some(order),
                start,
                step.connection,
                entered,
                (next_cost, next_majors),
                value,
            );
            if let Some(alike) = &mut self.alike {
                alike.leave(depth, edge, step.class, narrowed);
            }
            if self.exhausted {
                break;
            }
        }
        self.shut[depth] = shut;
    }

    /// The hexes the connection enters that the route has not yet been in, by the order it runs
    /// through them; it stays in the hex it leaves its stop in.
    fn entered(&self, start: usize, connection: usize) -> &'a [usize] {
        let Some(stays) = self.stays.get(connection) else {
            return &[];
        };
        let last = self
            .walking
            .last()
            .map_or(self.problem.stops[start].hex, |&id| {
                *self.stays[id].last().unwrap()
            });
        let skip = usize::from(stays.first() == Some(&last));
        &stays[skip..]
    }

    fn record(&mut self, start: usize, end: usize, value: RouteValue) {
        let RouteValue {
            mut cost,
            mut majors,
            mut revenue,
            first_bonus,
            last_bonus,
            ..
        } = value;
        if !fleet::allowed_shape(
            Network {
                problem: self.problem,
                connections: self.connections,
                stays: self.stays,
                adjacency: self.adjacency,
                departures: self.departures,
                quotas: self.quotas,
                taken: self.taken,
            },
            &self.walking,
            start,
        ) {
            return;
        }
        let train = self.train;
        let problem = self.problem;
        // The route calls at its end, an optional stop or not.
        if train.optional(end) {
            cost += train.visit_costs[end];
            majors += train.majors(&problem.stops[end]);
            revenue += train.revenues[end];
            if cost > train.distance || train.major_limit.is_some_and(|limit| majors > limit) {
                return;
            }
        }
        self.count += 1;
        let visits = self.walking.len() + 1;
        let reversed = last_bonus > first_bonus;
        if !train.scores_payments() && !train.calls_selectively() && !train.subsidizes() {
            self.offer(revenue + first_bonus.max(last_bonus), reversed, vec![]);
            return;
        }
        let stops: Vec<_> = std::iter::once(start)
            .chain(self.walking.iter().map(|&id| self.connections[id].to))
            .collect();
        let called = self.called_stops(&stops, reversed, cost, majors);
        let fixed = revenue
            - stops
                .iter()
                .filter(|&&id| id == start || id == end || !train.optional(id))
                .map(|&id| train.revenues[id])
                .sum::<i32>();
        let subsidy = called.iter().map(|&id| train.subsidy(id)).sum::<i32>();
        if !train.scores_payments() {
            let paid = called.iter().map(|&id| train.revenues[id]).sum::<i32>();
            self.offer(
                fixed + paid + subsidy + first_bonus.max(last_bonus),
                reversed,
                vec![],
            );
            return;
        }
        let paid_revenue = |destination| {
            train.paid_revenue(&Payment {
                visits: &called,
                stops: &problem.stops,
                destination,
            })
        };
        let paid = paid_revenue(None);
        self.offer(
            fixed + paid + subsidy + first_bonus.max(last_bonus),
            reversed,
            vec![],
        );
        if !stops.iter().any(|&id| self.origins[problem.stops[id].hex]) {
            return;
        }
        for (from, reversed, first_stop_bonus) in
            [(end, false, first_bonus), (start, true, last_bonus)]
        {
            for extension in self.shortest_extensions(from) {
                let destination = problem.arcs[extension[extension.len() - 1]]
                    .to
                    .map(|stop| problem.stops[stop].hex);
                let extended = paid_revenue(destination);
                let value = fixed + extended + subsidy + first_stop_bonus;
                if extended <= paid || !self.wanted(value, visits) {
                    continue;
                }
                self.offer(value, reversed, extension);
            }
        }
    }

    /// The route's stops the train calls at, in the order it was walked, chosen in the order the
    /// game runs the route.
    fn called_stops(&self, stops: &[usize], reversed: bool, cost: u32, majors: u32) -> Vec<usize> {
        if !self.train.calls_selectively() {
            return stops.to_vec();
        }
        let mut oriented = stops.to_vec();
        if reversed {
            oriented.reverse();
        }
        let calls = self.train.called(self.problem, &oriented, cost, majors);
        let mut called: Vec<_> = oriented
            .into_iter()
            .zip(calls)
            .filter_map(|(id, call)| call.then_some(id))
            .collect();
        if reversed {
            called.reverse();
        }
        called
    }

    // Whether a candidate worth this much would be stored, checked before copying its lists.
    fn wanted(&mut self, revenue: i32, visits: usize) -> bool {
        self.max_value = self
            .max_value
            .max(revenue + visits as i32 * self.problem.longest_route_bonus_per_stop);
        self.would_want(revenue, visits)
    }

    // Never less so for more revenue or more stops.
    fn would_want(&self, revenue: i32, visits: usize) -> bool {
        if let Some(streaming) = &self.streaming {
            let depth = self.walking.len();
            return streaming.wanted(revenue, visits, self.partners[depth], self.caps[depth]);
        }
        let fleet_bonus = self.problem.longest_route_bonus_per_stop;
        // A bound may count more stops than any route has.
        let value = revenue.saturating_add((visits as i32).saturating_mul(fleet_bonus));
        self.floor.is_none_or(|floor| value > floor)
            && (!self.best_only
                || self
                    .candidates
                    .first()
                    .is_none_or(|best| best.value(fleet_bonus) < value))
    }

    fn offer(&mut self, revenue: i32, reversed: bool, extension: Vec<usize>) {
        let visits = self.walking.len() + 1;
        if !self.wanted(revenue, visits) {
            return;
        }
        for &r in extension
            .iter()
            .flat_map(|&arc| &self.problem.arcs[arc].resources)
        {
            self.used[r / 64] |= 1 << (r % 64);
        }
        let candidate = CandidateView {
            revenue,
            visits,
            connections: &self.walking,
            resources: &self.used,
            reversed,
            extension: &extension,
        };
        if let Some(streaming) = &mut self.streaming {
            // The route's stops so far first have their own partner search, each on from the
            // one before: the routes that follow from any of them begin where it came to.
            let depth = self.walking.len();
            let words = self.used.len();
            let mut from = self
                .sought
                .checked_sub(1)
                .map_or(0, |place| self.partners[place]);
            for place in self.sought.max(1)..depth {
                let track = &self.tracks[place * words..(place + 1) * words];
                from = streaming.first_clear(from, track, revenue, visits);
                self.partners[place] = from;
            }
            self.sought = self.sought.max(depth);
            let reached = streaming.offer(candidate, from);
            self.exhausted |= streaming.exhausted;
            // An extension's track is no part of the routes on from this one.
            if extension.is_empty() {
                self.partners[depth] = reached;
                self.sought = depth + 1;
            }
        } else {
            self.offer_stored(revenue, reversed, &extension);
        }
        for &r in extension
            .iter()
            .flat_map(|&arc| &self.problem.arcs[arc].resources)
        {
            self.used[r / 64] &= !(1 << (r % 64));
        }
    }

    fn offer_stored(&mut self, revenue: i32, reversed: bool, extension: &[usize]) {
        let visits = self.walking.len() + 1;
        let ids = self.walking.len() + extension.len();
        if self.candidates.growth_peak(
            ids,
            self.selection_bytes_per_candidate,
            self.problem.resource_count,
        ) > self.memory_budget
        {
            match self.when_full {
                WhenFull::Pause => {
                    self.full = true;
                    self.exhausted = true;
                    return;
                }
                WhenFull::Raise => self.raise_floor(),
                WhenFull::Halve if self.best_only => {}
                WhenFull::Halve => {
                    self.reclaim(false);
                    // Halved whatever the payload when growing would still overflow, so the
                    // floor rises and the next routes are not trimmed for nothing over and over.
                    if self.candidates.growth_peak(
                        ids,
                        self.selection_bytes_per_candidate,
                        self.problem.resource_count,
                    ) > self.memory_budget
                    {
                        self.reclaim(true);
                    }
                }
            }
            if !self.wanted(revenue, visits) {
                return;
            }
            if self.candidates.growth_peak(
                ids,
                self.selection_bytes_per_candidate,
                self.problem.resource_count,
            ) > self.memory_budget
            {
                self.limited = true;
                return;
            }
        }
        if self.best_only {
            self.candidates.entries.clear();
            self.candidates.arena.truncate(0);
        }
        self.candidates.push(CandidateView {
            revenue,
            visits,
            connections: &self.walking,
            resources: &self.used,
            reversed,
            extension,
        });
    }

    /// Keeps the stored routes worth more than the middle one of them. They are neither put in
    /// order nor compared, which a list filled again and again has no time for.
    fn raise_floor(&mut self) {
        let bonus = self.problem.longest_route_bonus_per_stop;
        let mut values: Vec<i32> = self
            .candidates
            .iter()
            .map(|candidate| candidate.value(bonus))
            .collect();
        if values.is_empty() {
            return;
        }
        let middle = values.len() / 2;
        let floor = *values.select_nth_unstable(middle).1;
        self.candidates.keep_above(floor, bonus);
        self.floor = Some(self.floor.map_or(floor, |kept| kept.max(floor)));
        self.limited = true;
    }

    fn reclaim(&mut self, halve: bool) {
        self.candidates.dedup(Network {
            problem: self.problem,
            connections: self.connections,
            stays: self.stays,
            adjacency: self.adjacency,
            departures: self.departures,
            quotas: self.quotas,
            taken: self.taken,
        });
        let payload: usize = self
            .candidates
            .iter()
            .map(|candidate| {
                candidate_bytes(
                    candidate,
                    self.candidates.arena.id_bytes(),
                    self.selection_bytes_per_candidate,
                )
            })
            .sum();
        if halve
            || payload + Candidates::dedup_bytes(self.problem.resource_count)
                > self.memory_budget / 2
        {
            let fleet_bonus = self.problem.longest_route_bonus_per_stop;
            self.candidates
                .entries
                .sort_unstable_by_key(|c| std::cmp::Reverse(c.value(fleet_bonus)));
            self.candidates.entries.truncate(self.candidates.len() / 2);
            self.floor = self
                .candidates
                .last()
                .map(|candidate| candidate.value(fleet_bonus));
            self.candidates.compact();
            self.limited = true;
        }
        // The halved lists keep their capacity for the routes that follow: shrinking them only to
        // grow them again scatters freed blocks that WebAssembly's allocator cannot reuse for the
        // next growth, which then traps at the memory maximum. The search shrinks them once, at its end.
    }

    // Extensions search arcs by the stretch gauge they leave on, as each continues only on track a
    // route could run.
    fn shortest_extensions(&mut self, from: usize) -> Vec<Vec<usize>> {
        let problem = self.problem;
        let departures = self.departures;
        let mut queue = vec![];
        for &arc in &departures[from] {
            if let Some(state) = self.extension_state(arc, Stretch::Either) {
                self.extension_parents[state] = EXTENSION_ROOT;
                queue.push(state);
            }
        }
        let mut reached = vec![];
        let mut extensions = vec![];
        let mut head = 0;
        while let Some(&state) = queue.get(head) {
            head += 1;
            let arc_id = state / self.stretch_states;
            let arc = &problem.arcs[arc_id];
            let (following, stretch): (&[usize], Stretch) = match arc.to {
                None => (&arc.next, Stretch::of_state(state, self.stretch_states)),
                Some(stop_id) => {
                    let stop = &problem.stops[stop_id];
                    if self.destinations[stop.hex] && !reached.contains(&stop.hex) {
                        let extension = self.extension_to(state);
                        if is_simple_extension(problem, &extension) {
                            reached.push(stop.hex);
                            extensions.push(extension);
                        }
                    }
                    if stop.city || stop.town {
                        (&departures[stop_id], Stretch::Either)
                    } else {
                        (&[], Stretch::Either)
                    }
                }
            };
            for &next in following {
                if next == arc_id ^ 1 {
                    continue;
                }
                if let Some(next_state) = self.extension_state(next, stretch)
                    && self.extension_parents[next_state] == UNREACHED
                {
                    self.extension_parents[next_state] = state;
                    queue.push(next_state);
                }
            }
        }
        for state in queue {
            self.extension_parents[state] = UNREACHED;
        }
        extensions
    }

    // The search state for following the arc on the stretch, if an extension may follow it.
    fn extension_state(&self, arc_id: usize, stretch: Stretch) -> Option<usize> {
        let stretch = stretch.along(self.problem.arcs[arc_id].gauge)?;
        self.extends_along(arc_id)
            .then_some(arc_id * self.stretch_states + stretch.state_index(self.stretch_states))
    }

    fn extends_along(&self, arc_id: usize) -> bool {
        let arc = &self.problem.arcs[arc_id];
        !arc.terminal
            && arc.to.is_none_or(|stop| self.problem.stops[stop].allowed)
            && !arc
                .resources
                .iter()
                .any(|&r| self.used[r / 64] & (1 << (r % 64)) != 0)
    }

    fn extension_to(&self, state: usize) -> Vec<usize> {
        let mut extension = vec![state / self.stretch_states];
        let mut current = state;
        while self.extension_parents[current] != EXTENSION_ROOT {
            current = self.extension_parents[current];
            extension.push(current / self.stretch_states);
        }
        extension.reverse();
        extension
    }
}

// What one compiled connection costs: itself, its lists with allocator overhead, and its entry in
// the stop adjacency built from them.
fn connection_bytes(connection: &Connection) -> usize {
    std::mem::size_of::<Connection>()
        + (connection.paths.len() + connection.resources.len() + connection.hexes.len())
            * std::mem::size_of::<usize>()
        + 3 * ALLOCATION
        + std::mem::size_of::<usize>()
}

// Reserve selection storage during enumeration, before its tables are allocated.
fn candidate_bytes(candidate: &Candidate, id_bytes: usize, selection_bytes: usize) -> usize {
    std::mem::size_of::<Candidate>() + candidate.id_count() * id_bytes + selection_bytes
}

fn is_simple_extension(problem: &Problem, extension: &[usize]) -> bool {
    let arcs = extension.iter().map(|&arc| &problem.arcs[arc]);
    let mut resources: Vec<_> = arcs.clone().flat_map(|arc| arc.resources.iter()).collect();
    let count = resources.len();
    resources.sort_unstable();
    resources.dedup();
    let revisits_junction = |junctions: &mut Vec<usize>| {
        junctions.sort_unstable();
        junctions.windows(3).any(|three| three[0] == three[2])
    };
    let mut junctions = vec![];
    for arc in arcs {
        junctions.extend(&arc.junctions);
        if arc.to.is_some() {
            if revisits_junction(&mut junctions) {
                return false;
            }
            junctions.clear();
        }
    }
    resources.len() == count && !revisits_junction(&mut junctions)
}

struct CandidateGroup<'a> {
    candidates: &'a Candidates,
    words: std::ops::Range<usize>,
    trains: std::ops::Range<usize>,
    longest_suffix: Vec<usize>,
}

fn longest_suffix(candidates: &[Candidate], longest_bonus: i32) -> Vec<usize> {
    if longest_bonus == 0 {
        return vec![];
    }
    let mut suffix = vec![0; candidates.len() + 1];
    for index in (0..candidates.len()).rev() {
        suffix[index] = suffix[index + 1].max(candidates[index].visits);
    }
    suffix
}

struct StreamingSelection<'a> {
    stored: Rc<Candidates>,
    // How many of the stored routes, from the first, are paired with.
    leading: usize,
    // They are the leading part of a list that is not whole.
    part: bool,
    network: Network<'a>,
    connection_conflicts: Vec<u8>,
    extension_conflicts: Vec<u8>,
    resource_candidates: ResourceCandidates,
    // By connection, the most a stored route clear of its track is worth; none where the
    // longest route's bonus makes a pair worth more than its routes.
    clear: Vec<i32>,
    longest_suffix: Vec<usize>,
    longest_bonus: i32,
    revenue: i32,
    best_stored: Option<usize>,
    best_streamed: Option<Lone>,
    deadline: f64,
    checks: u64,
    next_clock_check: u64,
    // The words of indexed routes and the routes beyond them looked at for partners.
    scans: u64,
    descended: bool,
    exhausted: bool,
}

// What putting a list in order takes for each of its routes, in milliseconds, on a slow machine.
const ORDERING_MS: f64 = 0.000_3;

// How many of the most valuable stored routes are looked at for one clear of each piece of track.
const CLEAR_ROUTES: usize = 65_536;
// So many words of stored routes are few.
const FEW_WORDS: usize = 256;

// Looking at so many words of stored routes for a partner takes about a step of the search, as
// does trying so many connections on from a stop.
const SCANS_PER_STEP: u64 = 8;
const MOVES_PER_STEP: u64 = 16;

impl<'a> StreamingSelection<'a> {
    fn new(
        stored: Rc<Candidates>,
        network: Network<'a>,
        deadline: f64,
        memory_budget: usize,
    ) -> Self {
        Self::through(stored, usize::MAX, false, network, deadline, memory_budget)
    }

    /// A selection that pairs with no more than so many of the stored routes, from the first.
    fn leading(
        stored: Rc<Candidates>,
        leading: usize,
        network: Network<'a>,
        deadline: f64,
        memory_budget: usize,
    ) -> Self {
        Self::through(stored, leading, true, network, deadline, memory_budget)
    }

    fn through(
        stored: Rc<Candidates>,
        leading: usize,
        part: bool,
        network: Network<'a>,
        deadline: f64,
        memory_budget: usize,
    ) -> Self {
        let leading = leading.min(stored.len());
        let longest_bonus = network.problem.longest_route_bonus_per_stop;
        let suffix_bytes = if longest_bonus > 0 {
            std::mem::size_of::<usize>()
        } else {
            0
        };
        let index_budget = memory_budget
            .saturating_sub(
                stored.bytes(suffix_bytes) + network.streaming_scratch_bytes() + suffix_bytes,
            )
            .min(network.problem.memory_budget_bytes / 4);
        let words =
            ResourceCandidates::words_for_budget(network.problem.resource_count, index_budget)
                .min(leading.div_ceil(64));
        let mut resource_candidates =
            ResourceCandidates::new(network.problem.resource_count, words);
        for (id, candidate) in stored.iter().take(leading.min(words * 64)).enumerate() {
            resource_candidates.insert(id, stored.resources(candidate, network));
        }
        let mut best_stored = None;
        let mut revenue = 0;
        for (id, candidate) in stored.iter().take(leading).enumerate() {
            if candidate.value(longest_bonus) > revenue {
                revenue = candidate.value(longest_bonus);
                best_stored = Some(id);
            }
        }
        Self {
            network,
            clear: if longest_bonus == 0 {
                Self::clear(&stored[..leading], &stored, network)
            } else {
                vec![]
            },
            leading,
            part,
            resource_candidates,
            connection_conflicts: vec![0; network.connections.len()],
            extension_conflicts: if stored.iter().any(|candidate| candidate.extension_len > 0) {
                vec![0; network.problem.arcs.len()]
            } else {
                vec![]
            },
            longest_suffix: longest_suffix(&stored, longest_bonus),
            stored,
            longest_bonus,
            revenue,
            best_stored,
            best_streamed: None,
            deadline,
            checks: 0,
            next_clock_check: 1024,
            scans: 0,
            descended: false,
            exhausted: false,
        }
    }

    /// By connection, the most a stored route clear of its track is worth: the first of them,
    /// the most valuable first, that is clear of each piece of track bounds every route clear
    /// of it. Looking no further than so many routes, the last looked at bounds the rest.
    fn clear(leading: &[Candidate], stored: &Candidates, network: Network<'_>) -> Vec<i32> {
        let pieces = network.problem.resource_count;
        let mut without = vec![0; pieces];
        let mut unsettled: Vec<u64> = (0..pieces.div_ceil(64))
            .map(|word| {
                let left = pieces - word * 64;
                if left >= 64 {
                    u64::MAX
                } else {
                    (1 << left) - 1
                }
            })
            .collect();
        let mut track = vec![0; unsettled.len()];
        for candidate in leading.iter().take(CLEAR_ROUTES) {
            if unsettled.iter().all(|&word| word == 0) {
                break;
            }
            stored.resource_bits(candidate, network, &mut track);
            for (word, (unsettled, track)) in unsettled.iter_mut().zip(&track).enumerate() {
                let mut clear = *unsettled & !track;
                while clear != 0 {
                    without[word * 64 + clear.trailing_zeros() as usize] = candidate.revenue.max(0);
                    clear &= clear - 1;
                }
                *unsettled &= track;
            }
        }
        // No route looked at is clear of the track left: one further on is worth no more than it.
        let rest = leading
            .get(CLEAR_ROUTES)
            .map_or(0, |next| next.revenue.max(0));
        for (word, &unsettled) in unsettled.iter().enumerate() {
            let mut left = unsettled;
            while left != 0 {
                without[word * 64 + left.trailing_zeros() as usize] = rest;
                left &= left - 1;
            }
        }
        network
            .connections
            .iter()
            .map(|edge| {
                edge.resources
                    .iter()
                    .map(|&piece| without[piece])
                    .min()
                    .unwrap_or(i32::MAX)
            })
            .collect()
    }

    /// Whether the stored routes are the few leading ones of an unfinished list, all indexed:
    /// the partner search is then run for every stop a streamed route comes to. Through a whole
    /// list it drops too few routes for the stored routes it looks at.
    fn few(&self) -> bool {
        self.part
            && self.resource_candidates.words <= FEW_WORDS
            && self.resource_candidates.words == self.leading.div_ceil(64)
    }

    /// The most a stored route clear of the connection's track is worth.
    fn clear_of(&self, connection: usize) -> i32 {
        self.clear.get(connection).copied().unwrap_or(i32::MAX)
    }

    // A route may run alone rather than beside a stored one that loses money.
    fn upper(&self, revenue: i32, visits: usize, index: usize) -> i32 {
        let longest = visits.max(self.longest_suffix.get(index).copied().unwrap_or(0)) as i32;
        let stored = self.stored[..self.leading].get(index);
        revenue
            .saturating_add(stored.map_or(0, |c| c.revenue.max(0)))
            .saturating_add(longest.saturating_mul(self.longest_bonus))
    }

    /// Whether a route worth this much could better the operation, beside a stored route from
    /// this word of them on that is worth no more than the cap.
    fn wanted(&self, revenue: i32, visits: usize, from: usize, cap: i32) -> bool {
        !self.exhausted
            && self.upper(revenue, visits, from * 64) > self.revenue
            && revenue.saturating_add(cap) > self.revenue
    }

    /// The best pair found, as the two trains' routes; none where it was seeded with a better one.
    fn operation(&self, stored: usize, streamed: usize) -> Vec<Lone> {
        let mut routes = vec![];
        if let Some(id) = self.best_stored {
            routes.push(self.stored.lone(id, stored, self.network));
        }
        if let Some(lone) = self.best_streamed.clone() {
            routes.push(Lone {
                route: Route {
                    train: streamed,
                    ..lone.route
                },
                ..lone
            });
        }
        routes.sort_unstable_by_key(|lone| lone.route.train);
        routes
    }

    // Starts from a known operation's revenue, so only better pairs are kept.
    fn seed(&mut self, revenue: i32) {
        if revenue > self.revenue {
            self.revenue = revenue;
            self.best_stored = None;
            self.best_streamed = None;
        }
    }

    fn timed_out(&mut self) -> bool {
        if self.checks >= self.next_clock_check {
            self.next_clock_check = self.checks + 1024;
            if self.descended && milliseconds() > self.deadline {
                self.exhausted = true;
            }
        }
        self.exhausted
    }

    /// Goes on with a stream that stopped at its time, until another.
    fn go_on(&mut self, deadline: f64) {
        self.deadline = deadline;
        self.exhausted = false;
    }

    /// The first word of indexed stored routes, from this one on, with a route clear of the
    /// track: where a partner search of a route with that track and more may begin. It stops
    /// short where no stored route further on could make a better pair of a route worth this
    /// much, and at the routes that are not indexed.
    fn first_clear(&mut self, from: usize, track: &[u64], revenue: i32, visits: usize) -> usize {
        let mut word = from;
        while word < self.resource_candidates.words
            && self.upper(revenue, visits, word * 64) > self.revenue
        {
            self.checks += 64;
            self.scans += 1;
            if self.timed_out() || self.resource_candidates.compatible_word(word, track) != 0 {
                break;
            }
            word += 1;
        }
        word
    }

    /// Pairs the route with the best stored route clear of it, looking from this word of the
    /// stored routes on. Returns the word the search came to: the first with a route clear of
    /// this one, or where no stored route further on could make a better pair.
    fn offer(&mut self, candidate: CandidateView<'_>, from: usize) -> usize {
        // Each stored connection's conflict with the route is found once, for the stored routes
        // beyond the indexed ones.
        let mut cached = false;
        let mut revenue = candidate.revenue + candidate.visits as i32 * self.longest_bonus;
        let mut partner = None;
        let words = self.leading.div_ceil(64);
        let mut reached = words;
        let mut clear = None;
        'partners: for word in from..words {
            reached = word;
            let start = word * 64;
            if self.upper(candidate.revenue, candidate.visits, start) <= self.revenue.max(revenue) {
                break;
            }
            let indexed = word < self.resource_candidates.words;
            let mut available = if indexed {
                self.checks += 64;
                self.scans += 1;
                if self.timed_out() {
                    break;
                }
                self.resource_candidates
                    .compatible_word(word, candidate.resources)
            } else {
                u64::MAX
            };
            while available != 0 {
                let id = start + available.trailing_zeros() as usize;
                available &= available - 1;
                if id >= self.leading
                    || self.upper(candidate.revenue, candidate.visits, id)
                        <= self.revenue.max(revenue)
                {
                    break 'partners;
                }
                let stored = self.stored[id];
                if !indexed {
                    self.checks += 1;
                    self.scans += 1;
                    if self.timed_out() {
                        break 'partners;
                    }
                    if !cached {
                        self.connection_conflicts.fill(0);
                        self.extension_conflicts.fill(0);
                        cached = true;
                    }
                    let extension_start = stored.offset + stored.visits - 1;
                    let holds =
                        |piece: &usize| candidate.resources[piece / 64] >> (piece % 64) & 1 == 1;
                    if self
                        .stored
                        .first_quotas(&stored, self.network)
                        .iter()
                        .any(holds)
                        || self.stored.arena.any(stored.offset..extension_start, |id| {
                            resource_conflict(
                                &mut self.connection_conflicts[id],
                                &self.network.connections[id].resources,
                                candidate.resources,
                            )
                        })
                        || self.stored.arena.any(
                            extension_start..extension_start + stored.extension_len,
                            |id| {
                                resource_conflict(
                                    &mut self.extension_conflicts[id],
                                    &self.network.problem.arcs[id].resources,
                                    candidate.resources,
                                )
                            },
                        )
                    {
                        continue;
                    }
                }
                clear = clear.or(Some(word));
                let total = candidate.revenue
                    + stored.revenue
                    + candidate.visits.max(stored.visits) as i32 * self.longest_bonus;
                if total > revenue {
                    revenue = total;
                    partner = Some(id);
                }
                if self.longest_bonus == 0 {
                    break 'partners;
                }
            }
            reached = word + 1;
        }
        if revenue > self.revenue {
            self.revenue = revenue;
            self.best_stored = partner;
            self.best_streamed = Some(Lone {
                revenue: candidate.revenue,
                visits: candidate.visits,
                track: candidate.resources.to_vec(),
                route: self.network.route(
                    0,
                    candidate.reversed,
                    candidate.connections.iter().copied(),
                    candidate.extension.iter().copied(),
                ),
            });
        }
        self.descended = true;
        clear.unwrap_or(reached)
    }
}

fn resource_conflict(cached: &mut u8, resources: &[usize], used: &[u64]) -> bool {
    if *cached == 0 {
        *cached = 1 + u8::from(
            resources
                .iter()
                .any(|&r| used[r / 64] & (1 << (r % 64)) != 0),
        );
    }
    *cached == 2
}

struct ResourceCandidates {
    rows: Vec<Vec<u64>>,
    words: usize,
}

impl ResourceCandidates {
    fn words_for_budget(resources: usize, budget: usize) -> usize {
        if resources == 0 {
            return 0;
        }
        budget
            .saturating_sub(resources * (std::mem::size_of::<Vec<u64>>() + ALLOCATION) + ALLOCATION)
            / (resources * std::mem::size_of::<u64>())
    }

    fn new(resources: usize, words: usize) -> Self {
        Self {
            rows: if words == 0 {
                vec![]
            } else {
                vec![vec![0; words]; resources]
            },
            words,
        }
    }

    fn insert(&mut self, id: usize, resources: impl Iterator<Item = usize>) {
        resources.for_each(|resource| self.rows[resource][id / 64] |= 1 << (id % 64));
    }

    fn compatible_word(&self, word: usize, used: &[u64]) -> u64 {
        let mut compatible = u64::MAX;
        for (index, &bits) in used.iter().enumerate() {
            let mut bits = bits;
            while bits != 0 {
                let resource = index * 64 + bits.trailing_zeros() as usize;
                bits &= bits - 1;
                compatible &= !self.rows[resource][word];
                if compatible == 0 {
                    return 0;
                }
            }
        }
        compatible
    }
}

// Which candidates each candidate can run beside. Selection only asks about candidates after the
// one chosen, so columns before the first group's suffix are never kept.
struct Compatibility {
    // Candidates using each resource, over the words from `base`.
    resource_candidates: ResourceCandidates,
    base: usize,
    words: usize,
    // With more than two trains a candidate can be chosen under several parents, so its row is
    // cached; dropped together once the cache would exceed `row_budget` bytes. With two trains
    // each row is used once, and one buffer is reused.
    rows: Vec<Option<Vec<u64>>>,
    scratch: Vec<u64>,
    row_budget: usize,
    row_bytes: usize,
}

impl Compatibility {
    fn new(
        groups: &[CandidateGroup<'_>],
        network: Network<'_>,
        words: usize,
        row_budget: usize,
    ) -> Self {
        let train_count = groups.last().map_or(0, |group| group.trains.end);
        let base = groups.first().map_or(words, |group| {
            if group.trains.len() > 1 {
                group.words.start
            } else {
                group.words.end
            }
        });
        if train_count <= 1 {
            return Self {
                resource_candidates: ResourceCandidates::new(0, 0),
                base: words,
                words,
                rows: vec![],
                scratch: vec![],
                row_budget,
                row_bytes: 0,
            };
        }
        let mut resource_candidates =
            ResourceCandidates::new(network.problem.resource_count, words - base);
        // Routes may share the pieces that more than one route may run on: those are counted.
        let shared_from = network.problem.shared_from();
        for group in groups.iter().filter(|group| group.words.end > base) {
            for (index, candidate) in group.candidates.iter().enumerate() {
                let word = group.words.start + index / 64;
                if word < base {
                    continue;
                }
                resource_candidates.insert(
                    (word - base) * 64 + index % 64,
                    group
                        .candidates
                        .resources(candidate, network)
                        .filter(|&piece| piece < shared_from),
                );
            }
        }
        Self {
            resource_candidates,
            base,
            words,
            rows: if train_count > 2 {
                vec![None; words * 64]
            } else {
                vec![]
            },
            scratch: vec![],
            row_budget,
            row_bytes: 0,
        }
    }

    fn row(&mut self, id: usize, resources: impl Iterator<Item = usize>, start: usize) -> &[u64] {
        let fill = |compatible: &mut Vec<u64>, resource_candidates: &ResourceCandidates| {
            compatible.clear();
            compatible.resize(self.words - start, u64::MAX);
            // No candidates follow, and no columns were kept for them.
            if compatible.is_empty() {
                return;
            }
            resources.for_each(|resource| {
                for (bits, conflicts) in compatible
                    .iter_mut()
                    .zip(&resource_candidates.rows[resource][start - self.base..])
                {
                    *bits &= !conflicts;
                }
            });
        };
        if self.rows.is_empty() {
            fill(&mut self.scratch, &self.resource_candidates);
            return &self.scratch;
        }
        if self.rows[id].is_none() {
            let bytes = (self.words - start) * std::mem::size_of::<u64>();
            if self.row_bytes + bytes > self.row_budget {
                self.rows.iter_mut().for_each(|row| *row = None);
                self.row_bytes = 0;
            }
            self.row_bytes += bytes;
            let mut compatible = vec![];
            fill(&mut compatible, &self.resource_candidates);
            self.rows[id] = Some(compatible);
        }
        self.rows[id].as_deref().unwrap()
    }
}

struct Selection<'a> {
    network: Network<'a>,
    groups: Vec<CandidateGroup<'a>>,
    order: Vec<(usize, usize)>,
    available: Vec<Vec<u64>>,
    first_words: Vec<Vec<usize>>,
    compatibility: Compatibility,
    longest_bonus: i32,
    current: Vec<(usize, usize)>,
    best: Vec<(usize, usize)>,
    revenue: i32,
    expansions: u64,
    deadline: f64,
    // The steps the selection may take.
    steps: u64,
    exhausted: bool,
    // The first descent picks each train's best compatible candidate and ends at the first leaf or
    // bound; it always finishes, so an interrupted selection still returns a legal operation.
    descended: bool,
    // The quotas of more than one route.
    quotas: Vec<Counted>,
}

/// A quota of more than one route in a selection: the routes that run on its piece, as bits
/// over every train's routes, and how many of the routes chosen do.
struct Counted {
    routes: usize,
    holders: Vec<u64>,
    held: usize,
}

impl Counted {
    fn holds(&self, word: usize, bit: usize) -> bool {
        self.holders[word] >> bit & 1 == 1
    }
}

impl<'a> Selection<'a> {
    fn new(
        candidates: &'a [Rc<Candidates>],
        network: Network<'a>,
        limit: Limit,
        row_budget: usize,
    ) -> Self {
        let longest_bonus = network.problem.longest_route_bonus_per_stop;
        let mut profiles: Vec<Vec<usize>> = vec![];
        for train in 0..candidates.len() {
            if let Some(profile) = profiles
                .iter_mut()
                .find(|profile| Rc::ptr_eq(&candidates[profile[0]], &candidates[train]))
            {
                profile.push(train);
            } else {
                profiles.push(vec![train]);
            }
        }
        profiles.sort_by_key(|profile| {
            (
                std::cmp::Reverse(candidates[profile[0]].first().map_or(0, |c| c.revenue)),
                std::cmp::Reverse(candidates[profile[0]].len()),
            )
        });
        let mut groups = vec![];
        let mut order = vec![];
        let mut initial = vec![];
        for profile in profiles {
            let routes = &candidates[profile[0]];
            let first_train = order.len();
            order.extend(profile.into_iter().map(|train| (train, groups.len())));
            let start = initial.len();
            initial.resize(start + routes.len().div_ceil(64), u64::MAX);
            if !routes.len().is_multiple_of(64) {
                *initial.last_mut().unwrap() = (1 << (routes.len() % 64)) - 1;
            }
            groups.push(CandidateGroup {
                candidates: routes,
                words: start..initial.len(),
                trains: first_train..order.len(),
                longest_suffix: longest_suffix(routes, longest_bonus),
            });
        }
        let compatibility = Compatibility::new(&groups, network, initial.len(), row_budget);
        let quotas = network
            .problem
            .quotas
            .iter()
            .filter(|quota| quota.routes > 1)
            .map(|quota| {
                let mut holders = vec![0; initial.len()];
                for group in &groups {
                    for (index, candidate) in group.candidates.iter().enumerate() {
                        if group
                            .candidates
                            .quotas(candidate, network)
                            .any(|piece| piece == quota.piece)
                        {
                            holders[group.words.start + index / 64] |= 1 << (index % 64);
                        }
                    }
                }
                Counted {
                    routes: quota.routes,
                    holders,
                    held: 0,
                }
            })
            .collect();
        let mut available = vec![vec![0; initial.len()]; order.len() + 1];
        available[0] = initial;
        let first_words =
            vec![groups.iter().map(|group| group.words.start).collect(); order.len() + 1];
        Self {
            network,
            groups,
            order,
            available,
            first_words,
            compatibility,
            longest_bonus,
            current: vec![],
            best: vec![],
            revenue: 0,
            expansions: 0,
            deadline: limit.deadline,
            steps: limit.steps.saturating_sub(network.taken.get()),
            exhausted: false,
            descended: false,
            quotas,
        }
    }

    fn upper(&self, depth: usize, group_id: usize, mut longest: usize) -> (i32, usize) {
        let mut revenue = 0;
        for (id, group) in self.groups.iter().enumerate().skip(group_id) {
            let mut remaining = group.trains.end - depth.max(group.trains.start);
            let mut first = true;
            for word in self.first_words[depth][id]..group.words.end {
                let mut bits = self.available[depth][word];
                while bits != 0 && remaining != 0 {
                    let index = (word - group.words.start) * 64 + bits.trailing_zeros() as usize;
                    bits &= bits - 1;
                    if first && self.longest_bonus != 0 {
                        longest = longest.max(group.longest_suffix[index]);
                        first = false;
                    }
                    // A train may stay idle rather than run at a loss.
                    revenue += group.candidates[index].revenue.max(0);
                    remaining -= 1;
                }
                if remaining == 0 {
                    break;
                }
            }
        }
        (revenue, longest)
    }

    fn timed_out(&mut self) -> bool {
        self.expansions += 1;
        if self.descended
            && (self.expansions > self.steps
                || (self.expansions == 1 || self.expansions.is_multiple_of(1024))
                    && milliseconds() > self.deadline)
        {
            self.exhausted = true;
        }
        self.exhausted
    }

    /// The best operation of the listed routes worth more than the revenue given, as the trains'
    /// routes, and whether the selection finished; its steps count towards the solve's.
    fn operation(mut self, revenue: i32, candidates: &[Rc<Candidates>]) -> (i32, Vec<Lone>, bool) {
        self.revenue = revenue;
        self.walk(0, 0, 0);
        let taken = self.network.taken;
        taken.set(taken.get() + self.expansions);
        self.best.sort_unstable_by_key(|&(train, _)| train);
        let routes = self
            .best
            .iter()
            .map(|&(train, id)| candidates[train].lone(id, train, self.network))
            .collect();
        (self.revenue, routes, !self.exhausted)
    }

    fn walk(&mut self, depth: usize, revenue: i32, longest: usize) {
        if self.timed_out() {
            return;
        }
        let total = revenue + longest as i32 * self.longest_bonus;
        if total > self.revenue {
            self.revenue = total;
            self.best.clone_from(&self.current);
        }
        if depth == self.order.len() {
            self.descended = true;
            return;
        }
        let (train, group) = self.order[depth];
        let (upper, longest_upper) = self.upper(depth, group, longest);
        if revenue + upper + longest_upper as i32 * self.longest_bonus <= self.revenue {
            self.descended = true;
            return;
        }
        let (remaining_upper, remaining_longest) = self.upper(depth, group + 1, longest);
        let start = self.groups[group].words.start;
        'candidates: for word in self.first_words[depth][group]..self.groups[group].words.end {
            while self.available[depth][word] != 0 {
                if self.timed_out() {
                    return;
                }
                let bit = self.available[depth][word].trailing_zeros() as usize;
                let index = (word - start) * 64 + bit;
                self.available[depth][word] &= !(1 << bit);
                let candidate = &self.groups[group].candidates[index];
                let next_revenue = revenue + candidate.revenue;
                let next_longest = longest.max(candidate.visits);
                let copies = self.groups[group].trains.end - depth;
                let bonus_upper = if self.longest_bonus == 0 {
                    0
                } else {
                    remaining_longest.max(self.groups[group].longest_suffix[index]) as i32
                        * self.longest_bonus
                };
                let alike = candidate.revenue.max(0) * (copies as i32 - 1);
                if revenue + candidate.revenue + alike + remaining_upper + bonus_upper
                    <= self.revenue
                {
                    // Leaving the trains idle is bound by the same sum unless this route and
                    // those after it lose money.
                    if candidate.revenue < 0 {
                        break 'candidates;
                    }
                    self.descended = true;
                    return;
                }
                self.current.push((train, index));
                for quota in &mut self.quotas {
                    quota.held += usize::from(quota.holds(word, bit));
                }
                if depth + 1 < self.order.len() {
                    let suffix_start = if self.groups[group].trains.len() > 1 {
                        start
                    } else {
                        self.groups[group].words.end
                    };
                    let resources = self.groups[group]
                        .candidates
                        .resources(candidate, self.network);
                    let compatible =
                        self.compatibility
                            .row(word * 64 + bit, resources, suffix_start);
                    let (parents, children) = self.available.split_at_mut(depth + 1);
                    for next_group in self.order[depth + 1].1..self.groups.len() {
                        let end = self.groups[next_group].words.end;
                        let mut first = end;
                        let from = if next_group == group {
                            word
                        } else {
                            self.first_words[depth][next_group]
                        };
                        for next_word in from..end {
                            let mut bits =
                                parents[depth][next_word] & compatible[next_word - suffix_start];
                            // A quota that holds all its routes holds no further one.
                            for quota in &self.quotas {
                                if quota.held == quota.routes {
                                    bits &= !quota.holders[next_word];
                                }
                            }
                            children[0][next_word] = bits;
                            if bits != 0 && first == end {
                                first = next_word;
                            }
                        }
                        self.first_words[depth + 1][next_group] = first;
                    }
                }
                self.walk(depth + 1, next_revenue, next_longest);
                for quota in &mut self.quotas {
                    quota.held -= usize::from(quota.holds(word, bit));
                }
                self.current.pop();
            }
        }
        let next = self.groups[group].trains.end;
        let (parents, children) = self.available.split_at_mut(next);
        children[0].copy_from_slice(&parents[depth]);
        let (parents, children) = self.first_words.split_at_mut(next);
        children[0].copy_from_slice(&parents[depth]);
        self.walk(next, revenue, longest);
    }
}

/// The track compiled into connections between stops.
struct Compiled {
    connections: Vec<Connection>,
    stays: Vec<Vec<usize>>,
    adjacency: Vec<Vec<usize>>,
    departures: Vec<Vec<usize>>,
    quotas: Vec<Vec<usize>>,
    taken: std::cell::Cell<u64>,
    bytes: usize,
    // Compilation stopped early, and whether for memory.
    exhausted: bool,
    limited: bool,
}

impl Compiled {
    fn new(problem: &Problem, deadline: f64) -> Self {
        let quotas = problem.stop_quotas();
        let mut compiler = Compiler {
            problem,
            quotas: &quotas,
            used: vec![false; problem.resource_count],
            junction_segments: vec![0; problem.junction_count],
            walking: vec![],
            connections: vec![],
            stays: vec![],
            deadline,
            expansions: 0,
            exhausted: false,
            memory_budget: problem.memory_budget_bytes / 4,
            stored_bytes: 0,
            limited: false,
        };
        for (arc_id, arc) in problem.arcs.iter().enumerate() {
            if let Some(from) = arc.from
                && problem.stops[from].allowed
            {
                compiler.walk(from, arc_id, Stretch::Either);
            }
        }
        let mut connections = compiler.connections;
        connections.shrink_to_fit();
        let mut adjacency = vec![vec![]; problem.stops.len()];
        for (id, connection) in connections.iter().enumerate() {
            adjacency[connection.from].push(id);
        }
        let mut departures = vec![vec![]; problem.stops.len()];
        for (id, arc) in problem.arcs.iter().enumerate() {
            if let Some(from) = arc.from {
                departures[from].push(id);
            }
        }
        Self {
            connections,
            stays: compiler.stays,
            adjacency,
            departures,
            taken: std::cell::Cell::new(0),
            bytes: compiler.stored_bytes,
            exhausted: compiler.exhausted,
            limited: compiler.limited,
            quotas,
        }
    }

    fn network<'a>(&'a self, problem: &'a Problem) -> Network<'a> {
        Network {
            problem,
            connections: &self.connections,
            stays: &self.stays,
            adjacency: &self.adjacency,
            departures: &self.departures,
            quotas: &self.quotas,
            taken: &self.taken,
        }
    }
}

pub fn solve(mut problem: Problem) -> Result<Solution, String> {
    validate(&problem)?;
    problem.merge_track();
    problem.limit_groups();
    Ok(routed(&problem))
}

/// The best operation found for a problem that is valid.
fn routed(problem: &Problem) -> Solution {
    let started = milliseconds();
    let compiled = Compiled::new(problem, started + problem.budget_ms);
    let clock = Clock {
        started,
        compile_ms: milliseconds() - started,
        budget_ms: problem.budget_ms,
        pace_ms: problem.pace_ms.unwrap_or(problem.budget_ms),
    };
    if problem.fleet.is_some() || problem.trains.len() < 2 {
        return operate(problem, &compiled, clock, clock.whole(), None).0;
    }
    if problem.trains.len() == 2 {
        return pair::solve(problem, &compiled, clock);
    }
    // Listing every train's routes settles most fleets soonest, and an outline costs an easy
    // fleet about as much again: the listing alone is tried first, for a small part of the time.
    let mut listed = 0;
    let mut first = (0, vec![]);
    if !compiled.exhausted && !compiled.limited {
        let (listing, routes) = operate(
            problem,
            &compiled,
            clock,
            clock.share(0, LISTING_FIRST_SHARE),
            None,
        );
        if listing.exhaustive {
            return listing;
        }
        listed = listing.expansions;
        first = (listing.revenue, routes);
    }
    let (operation, _) = operate(problem, &compiled, clock, clock.whole(), Some(first));
    Solution {
        expansions: operation.expansions + listed,
        ..operation
    }
}

#[derive(Clone, Copy)]
struct Clock {
    started: f64,
    compile_ms: f64,
    budget_ms: f64,
    pace_ms: f64,
}

// The steps a millisecond of a solve is paced at, about what its slowest searches take in
// WebAssembly, so that a stage limited to a share of the steps ends within that share of the time.
const STEPS_PER_MS: f64 = 5000.0;

impl Clock {
    fn whole(&self) -> Limit {
        Limit::until(self.started + self.budget_ms)
    }

    /// The limit of a stage that takes this share of the solve from the steps taken so far: its
    /// share of the steps the solve is paced at, and on a machine too slow for that pace twice
    /// the share of the time from now.
    fn share(&self, taken: u64, share: f64) -> Limit {
        Limit {
            deadline: (milliseconds() + self.budget_ms * 2.0 * share)
                .min(self.started + self.budget_ms),
            steps: taken.saturating_add((self.pace_ms * STEPS_PER_MS * share) as u64),
        }
    }

    /// The steps the solve is paced at that are left after those taken.
    fn steps_left(&self, taken: u64) -> u64 {
        ((self.pace_ms * STEPS_PER_MS) as u64).saturating_sub(taken)
    }

    /// The steps that putting so many routes in order stands for at the solve's pace.
    fn ordering_steps(routes: usize) -> u64 {
        (routes as f64 * ORDERING_MS * STEPS_PER_MS) as u64
    }
}

/// The best operation found within the limit, and its routes with their track where the fleet
/// was not outlined: of one train, of a fleet with a fleet policy, or of three trains or more
/// without one. The last is outlined when given an operation already found, which may be none:
/// the outline's first operation is the better of the two, and the trains' routes are then
/// listed above it.
fn operate(
    problem: &Problem,
    compiled: &Compiled,
    clock: Clock,
    limit: Limit,
    found: Option<(i32, Vec<Lone>)>,
) -> (Solution, Vec<Lone>) {
    let Clock {
        started,
        compile_ms,
        ..
    } = clock;
    let (connections, compiled_bytes, compiler_limited) =
        (&compiled.connections, compiled.bytes, compiled.limited);
    let network = compiled.network(problem);
    let mut candidates: Vec<_> = problem
        .trains
        .iter()
        .map(|_| Rc::new(Candidates::new(network)))
        .collect();
    let mut counts = vec![0; problem.trains.len()];
    let mut expansions = 0;
    let mut path_exhaustive = !compiled.exhausted;
    let mut memory_limited = compiler_limited;
    let previous_profile: Vec<Option<usize>> = (0..problem.trains.len())
        .map(|train_id| same_profile(problem, train_id))
        .collect();
    let mut profiles: Vec<Rc<Profile>> = vec![];
    for (train_id, train) in problem.trains.iter().enumerate() {
        profiles.push(match previous_profile[train_id] {
            Some(previous) => Rc::clone(&profiles[previous]),
            None => Rc::new(network.profile(train)),
        });
    }
    let mut profiles_left = previous_profile.iter().filter(|p| p.is_none()).count();
    let fleet = problem.trains.len() > 1 || problem.fleet.is_some();
    let row_budget = problem.memory_budget_bytes / 4;
    // A fleet's selection accounts for its own memory, from what the candidates leave.
    let selection_bytes_per_candidate = if problem.fleet.is_some() {
        0
    } else {
        selection_bytes(problem)
    };
    let mut candidate_budget = problem.memory_budget_bytes - row_budget - compiled_bytes;
    let mut outline = found.map(|(revenue, routes)| {
        let taken = network.taken.get();
        let operation = (clock.share(taken, OPERATION_SHARE), candidate_budget);
        let mut outline = network.outline(
            &profiles,
            &previous_profile,
            clock.share(taken, OUTLINE_SHARE),
            operation,
        );
        if revenue > outline.revenue {
            outline.adopt(revenue, routes);
            network.improve(&profiles, &mut outline, operation);
        }
        outline
    });
    // Every train runs its best route: nothing earns more.
    if let Some(outline) = &outline
        && outline
            .most()
            .is_some_and(|most| i64::from(outline.revenue) >= most)
    {
        let solution = Solution {
            revenue: outline.revenue,
            subsidy: 0,
            routes: outline.operation(),
            exhaustive: path_exhaustive,
            path_exhaustive,
            combination_exhaustive: true,
            candidates: outline.counts.clone(),
            memory_limited,
            expansions: outline.expansions,
            connections: connections.len(),
            compile_ms,
            path_ms: milliseconds() - started - compile_ms,
            combination_ms: 0.0,
        };
        return (solution, vec![]);
    }
    let path_limit = if fleet {
        limit.shortened(started, 0.75)
    } else {
        limit
    };
    for (train_id, train) in problem.trains.iter().enumerate() {
        if let Some(previous) = previous_profile[train_id] {
            candidates[train_id] = Rc::clone(&candidates[previous]);
            counts[train_id] = counts[previous];
            continue;
        }
        let train_limit = path_limit.part(network.taken.get(), profiles_left);
        let train_memory = candidate_budget / profiles_left;
        profiles_left -= 1;
        let search = network.search(
            train,
            SearchPlan {
                profile: Rc::clone(&profiles[train_id]),
                closed: None,
                limit: train_limit,
                memory_budget: train_memory,
                selection_bytes_per_candidate,
                best_only: !fleet,
                floor: outline.as_ref().and_then(|outline| outline.floor(train_id)),
                streaming: None,
                listed: None,
                when_full: WhenFull::Halve,
            },
        );
        candidate_budget -= search
            .candidates
            .bytes(selection_bytes_per_candidate)
            .min(candidate_budget);
        counts[train_id] = search.count;
        expansions += search.expansions;
        path_exhaustive &= !search.exhausted && !search.limited;
        memory_limited |= search.limited;
        candidates[train_id] = Rc::new(search.candidates);
    }
    let path_finished = milliseconds();
    if problem.fleet.is_some() {
        let (revenue, subsidy, routes, combination_exhaustive, limited, visits, counts) =
            fleet::solve(
                network,
                &candidates,
                limit.deadline,
                row_budget + candidate_budget,
            );
        memory_limited |= limited;
        let solution = Solution {
            revenue,
            subsidy,
            routes,
            exhaustive: path_exhaustive && combination_exhaustive && !memory_limited,
            path_exhaustive,
            combination_exhaustive,
            candidates: counts,
            memory_limited,
            expansions: expansions + visits,
            connections: connections.len(),
            compile_ms,
            path_ms: path_finished - started - compile_ms,
            combination_ms: milliseconds() - path_finished,
        };
        return (solution, vec![]);
    }
    if let Some(outline) = &outline {
        for (count, listed) in counts.iter_mut().zip(&outline.counts) {
            *count += listed;
        }
    }
    let (mut revenue, mut routes, combination_exhaustive) =
        Selection::new(&candidates, network, limit, row_budget).operation(
            outline.as_ref().map_or(0, |outline| outline.revenue),
            &candidates,
        );
    // The routes found are kept apart from the lists, which make room for what follows.
    drop(candidates);
    if let Some(outline) = &mut outline {
        if revenue > outline.revenue {
            outline.adopt(revenue, std::mem::take(&mut routes));
        }
        // A listing cut short may leave an operation that one train alone betters.
        if !(path_exhaustive && combination_exhaustive) {
            let room = (problem.memory_budget_bytes - compiled_bytes) / 4;
            network.improve(&profiles, outline, (clock.whole(), room));
        }
        expansions += outline.expansions;
        revenue = outline.revenue;
    }
    let solution = Solution {
        revenue,
        subsidy: 0,
        routes: match &outline {
            Some(outline) => outline.operation(),
            None => routes.iter().map(|lone| lone.route.clone()).collect(),
        },
        exhaustive: path_exhaustive && combination_exhaustive,
        path_exhaustive,
        combination_exhaustive,
        candidates: counts,
        memory_limited,
        expansions,
        connections: connections.len(),
        compile_ms,
        path_ms: path_finished - started - compile_ms,
        combination_ms: milliseconds() - path_finished,
    };
    (solution, routes)
}

/// What each listed route takes of the tables that select among several trains' routes; a quota
/// takes a bit as a piece and another where its routes are counted.
fn selection_bytes(problem: &Problem) -> usize {
    std::mem::size_of::<Option<Vec<u64>>>()
        + std::mem::size_of::<usize>()
        + (problem.resource_count + problem.quotas.len()).div_ceil(8)
        + (problem.trains.len() + 1).div_ceil(8)
}

/// A train's best route clear of some track.
#[derive(Clone)]
struct Lone {
    revenue: i32,
    visits: usize,
    track: Vec<u64>,
    route: Route,
}

impl Lone {
    fn bytes(&self) -> usize {
        std::mem::size_of::<Self>()
            + self.route.connections.len() * (std::mem::size_of::<RouteConnection>() + ALLOCATION)
            + self
                .route
                .connections
                .iter()
                .map(|connection| connection.paths.len())
                .sum::<usize>()
                * std::mem::size_of::<usize>()
            + self.route.extension.len() * std::mem::size_of::<usize>()
            + self.track.len() * std::mem::size_of::<u64>()
            + 3 * ALLOCATION
    }
}

/// Two trains' routes kept apart: the track closed to each, and each one's best route clear of
/// its closed track. Their sum bounds every operation that keeps to the closed track.
struct Split {
    bound: i32,
    depth: usize,
    closed: [Rc<Vec<u64>>; 2],
    routes: [Rc<Lone>; 2],
}

impl PartialEq for Split {
    fn eq(&self, other: &Self) -> bool {
        (self.bound, self.depth) == (other.bound, other.depth)
    }
}

impl Eq for Split {}

impl PartialOrd for Split {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

// The most promising first; among equals the one with the most track closed, the nearest to
// routes that run clear.
impl Ord for Split {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        (self.bound, self.depth).cmp(&(other.bound, other.depth))
    }
}

/// The search that keeps two trains' routes apart, which stops and goes on.
struct Settling {
    splits: std::collections::BinaryHeap<Split>,
    alike: bool,
    // What the splits yet to be taken up hold of the memory budget.
    bytes: usize,
    // Routings since the operation last improved.
    idle: usize,
}

impl Settling {
    /// None unless both trains have a best route alone.
    fn new(problem: &Problem, profiles: &[Rc<Profile>], outline: &Outline) -> Option<Self> {
        let (Some(first), Some(second)) = (&outline.bests[0], &outline.bests[1]) else {
            return None;
        };
        outline.most()?;
        let words = problem.resource_count.div_ceil(64);
        Some(Self {
            splits: std::collections::BinaryHeap::from([Split {
                bound: first.revenue + second.revenue,
                depth: 0,
                closed: [Rc::new(vec![0; words]), Rc::new(vec![0; words])],
                routes: [Rc::new(first.clone()), Rc::new(second.clone())],
            }]),
            alike: Rc::ptr_eq(&profiles[0], &profiles[1]),
            bytes: 0,
            idle: 0,
        })
    }
}

// How far into a fleet's solve listing its routes outright goes before the fleet is outlined, and
// how far the outline's search for the trains' best routes alone and for its first operation.
// Where two trains are kept apart: how far into the solve that search first goes, after how many
// routings without a better operation it stops, and how many routings it needs room for.
const LISTING_FIRST_SHARE: f64 = 0.02;
const OUTLINE_SHARE: f64 = 0.3;
const OPERATION_SHARE: f64 = 0.4;
const EARLY_SETTLING_SHARE: f64 = 0.35;
const PATIENCE: usize = 4;
const SETTLING_ROUTINGS: u64 = 6;

/// A first operation for a fleet without a fleet policy, found by routing one train at a time
/// clear of the others, and what each train's best route alone is worth. A better operation
/// needs of each train a route worth more than the first operation less the other trains' best
/// routes, so only those are listed for the exact selection.
struct Outline {
    // By train, what its best route alone is worth, when its search finished, and the route.
    alone: Vec<Option<i32>>,
    bests: Vec<Option<Lone>>,
    // By train, its route in the best operation found so far: the first operation to begin with.
    routes: Vec<Option<Lone>>,
    revenue: i32,
    expansions: u64,
    counts: Vec<usize>,
    // The steps the searches for the trains' best routes alone took.
    alone_steps: u64,
    // By train, its routes where they are listed whole; none for a train whose are not.
    listed: Vec<Option<Listed>>,
}

/// A train's routes worth more than a floor listed whole, the most valuable first. Its best
/// route clear of some track is then looked up in place of a search.
struct Listed {
    routes: Rc<Candidates>,
    floor: Option<i32>,
}

impl Outline {
    /// Nothing yet known of the trains' routes.
    fn new(trains: usize) -> Self {
        Self {
            alone: vec![None; trains],
            bests: vec![None; trains],
            routes: vec![None; trains],
            revenue: 0,
            expansions: 0,
            counts: vec![0; trains],
            alone_steps: 0,
            listed: (0..trains).map(|_| None).collect(),
        }
    }

    fn value(routes: &[Option<Lone>], longest_bonus: i32) -> i32 {
        let running = || routes.iter().flatten();
        running().map(|lone| lone.revenue).sum::<i32>()
            + running().map(|lone| lone.visits).max().unwrap_or(0) as i32 * longest_bonus
    }

    /// What no operation can earn more than, when every train's best route alone is known.
    fn most(&self) -> Option<i64> {
        self.alone.iter().map(|alone| alone.map(i64::from)).sum()
    }

    /// What a route of the train must be worth more than to be part of a better operation.
    fn floor(&self, train: usize) -> Option<i32> {
        let others: i64 = (0..self.alone.len())
            .filter(|&other| other != train)
            .map(|other| self.alone[other].map(i64::from))
            .sum::<Option<i64>>()?;
        i32::try_from(i64::from(self.revenue) - others).ok()
    }

    fn operation(&self) -> Vec<Route> {
        self.routes
            .iter()
            .flatten()
            .map(|lone| lone.route.clone())
            .collect()
    }

    /// Takes an operation found elsewhere for its own.
    fn adopt(&mut self, revenue: i32, routes: Vec<Lone>) {
        self.revenue = revenue;
        self.routes = vec![None; self.alone.len()];
        for lone in routes {
            let train = lone.route.train;
            self.routes[train] = Some(lone);
        }
    }
}

// What every train's route search shares.
#[derive(Clone, Copy)]
struct Network<'a> {
    problem: &'a Problem,
    connections: &'a [Connection],
    /// The hexes each connection runs through in turn, when routes may not enter a hex again.
    stays: &'a [Vec<usize>],
    adjacency: &'a [Vec<usize>],
    departures: &'a [Vec<usize>],
    /// By stop, the pieces of the quotas its groups are under; no stops where there are none.
    quotas: &'a [Vec<usize>],
    /// The steps the solve's searches have taken so far.
    taken: &'a std::cell::Cell<u64>,
}

/// What every search for one train shares: the order it tries connections in, their classes,
/// what the rest of a route could still earn, and how far each stop is from a station.
struct Profile {
    // For the train's one best route: the stops that pay most first, connections by class.
    ranked: std::cell::OnceCell<(Rc<alike::Order>, Rc<alike::Classes>)>,
    outlook: Option<outlook::Outlook>,
    token_distance: Vec<u32>,
}

// How one train's routes are kept: stored within a memory budget, only above a value floor, or
// streamed through another train's stored routes.
struct SearchPlan<'a> {
    profile: Rc<Profile>,
    // Track other trains' routes run on.
    closed: Option<Vec<u64>>,
    limit: Limit,
    memory_budget: usize,
    selection_bytes_per_candidate: usize,
    best_only: bool,
    floor: Option<i32>,
    streaming: Option<StreamingSelection<'a>>,
    // An earlier listing's routes and where it stopped, for a listing that goes on from there.
    listed: Option<(Candidates, Resume)>,
    when_full: WhenFull,
}

/// What a listing does when its routes fill the memory.
#[derive(Clone, Copy)]
enum WhenFull {
    /// Drops routes on the same track as better ones, and keeps the most valuable half of the
    /// rest if they still take half the memory.
    Halve,
    /// Stops, for a higher floor to make room.
    Pause,
    /// Keeps the routes worth more than the middle one of them, as they stand.
    Raise,
}

impl<'a> Network<'a> {
    fn quotas_at(&self, stop: usize) -> &'a [usize] {
        self.quotas.get(stop).map_or(&[], Vec::as_slice)
    }

    fn streaming_scratch_bytes(&self) -> usize {
        self.connections.len()
            + if self
                .problem
                .trains
                .iter()
                .any(|train| !train.interconnections.is_empty())
            {
                self.problem.arcs.len() * self.problem.stretch_states()
            } else {
                0
            }
            + 2 * (std::mem::size_of::<Vec<u8>>() + ALLOCATION)
    }

    fn route(
        &self,
        train: usize,
        reversed: bool,
        ids: impl Iterator<Item = usize>,
        extension: impl Iterator<Item = usize>,
    ) -> Route {
        let mut connections: Vec<_> = ids
            .map(|id| {
                let edge = &self.connections[id];
                RouteConnection {
                    from: edge.from,
                    to: edge.to,
                    paths: edge.paths.clone(),
                }
            })
            .collect();
        if reversed {
            connections.reverse();
            for edge in &mut connections {
                std::mem::swap(&mut edge.from, &mut edge.to);
                edge.paths.reverse();
            }
        }
        Route {
            train,
            connections,
            extension: extension.map(|arc| self.problem.arcs[arc].path).collect(),
        }
    }

    /// The train's best route clear of the closed track and worth more than the floor, and
    /// whether the search for it finished.
    fn lone(
        &self,
        train: usize,
        profile: &Rc<Profile>,
        closed: Option<&[u64]>,
        floor: Option<i32>,
        limits: (Limit, usize),
        outline: &mut Outline,
    ) -> (Option<Lone>, bool) {
        // A train stays idle rather than run for nothing or at a loss.
        let floor = floor.unwrap_or(0).max(0);
        if let Some(Some(listed)) = outline.listed.get(train)
            && listed.floor.is_none_or(|kept| kept <= floor)
        {
            let lone = listed
                .routes
                .clear_of(closed.unwrap_or(&[]), floor, train, *self);
            return (lone, true);
        }
        let search = self.search(
            &self.problem.trains[train],
            SearchPlan {
                profile: Rc::clone(profile),
                closed: closed.map(<[u64]>::to_vec),
                limit: limits.0,
                memory_budget: limits.1,
                selection_bytes_per_candidate: 0,
                best_only: true,
                floor: Some(floor),
                streaming: None,
                listed: None,
                when_full: WhenFull::Halve,
            },
        );
        outline.expansions += search.expansions;
        outline.counts[train] += search.count;
        let lone = search
            .candidates
            .first()
            .map(|_| search.candidates.lone(0, train, *self));
        (lone, !search.exhausted && !search.limited)
    }

    /// The trains' best routes alone, found within the first limit, and a first operation, found
    /// within the limits' later one.
    fn outline(
        &self,
        profiles: &[Rc<Profile>],
        previous_profile: &[Option<usize>],
        alone: Limit,
        limits: (Limit, usize),
    ) -> Outline {
        let mut outline = Outline::new(self.problem.trains.len());
        self.seek_bests(&mut outline, profiles, previous_profile, (alone, limits.1));
        self.first_operation(&mut outline, profiles, limits);
        outline
    }

    /// Each train's best route alone, a train like an earlier one taking that one's.
    fn seek_bests(
        &self,
        outline: &mut Outline,
        profiles: &[Rc<Profile>],
        previous_profile: &[Option<usize>],
        limits: (Limit, usize),
    ) {
        let trains = self.problem.trains.len();
        let began = self.taken.get();
        let mut bests: Vec<Option<Lone>> = vec![None; trains];
        let mut left = previous_profile.iter().filter(|p| p.is_none()).count();
        for train in 0..trains {
            if let Some(previous) = previous_profile[train] {
                outline.alone[train] = outline.alone[previous];
                bests[train] = bests[previous].clone().map(|lone| Lone {
                    route: Route {
                        train,
                        ..lone.route
                    },
                    ..lone
                });
                continue;
            }
            let share = limits.0.part(self.taken.get(), left);
            left -= 1;
            let (best, finished) = self.lone(
                train,
                &profiles[train],
                None,
                None,
                (share, limits.1),
                outline,
            );
            if finished {
                outline.alone[train] = Some(self.worth(&best));
            }
            bests[train] = best;
        }
        outline.alone_steps = self.taken.get() - began;
        outline.bests = bests;
    }

    fn worth(&self, lone: &Option<Lone>) -> i32 {
        lone.as_ref().map_or(0, |lone| {
            lone.revenue + lone.visits as i32 * self.problem.longest_route_bonus_per_stop
        })
    }

    /// Routes one train after another beside those before it, the most valuable first, and two
    /// trains that differ in either order, each order in an even part of what the limit leaves;
    /// the operation is the outline's if it earns more than the one it has. Each train in turn
    /// then betters it. Under a quota the order also chooses which trains run on its piece, so
    /// three trains or more are tried with each in turn before the others.
    fn first_operation(
        &self,
        outline: &mut Outline,
        profiles: &[Rc<Profile>],
        limits: (Limit, usize),
    ) {
        let trains = self.problem.trains.len();
        let mut order: Vec<usize> = (0..trains).collect();
        order.sort_by_key(|&train| std::cmp::Reverse(self.worth(&outline.bests[train])));
        let mut orders = vec![order.clone()];
        if trains == 2 && !Rc::ptr_eq(&profiles[0], &profiles[1]) {
            order.reverse();
            orders.push(order);
        } else if trains > 2 && self.problem.quotas.iter().any(|quota| quota.routes > 0) {
            let leads = order[1..].iter().filter(|&&lead| {
                !(0..lead).any(|earlier| Rc::ptr_eq(&profiles[earlier], &profiles[lead]))
            });
            for &lead in leads {
                let others = order.iter().copied().filter(|&train| train != lead);
                orders.push(std::iter::once(lead).chain(others).collect());
            }
        }
        for (tried, order) in orders.iter().enumerate() {
            let share = limits.0.part(self.taken.get(), orders.len() - tried);
            let mut routes: Vec<Option<Lone>> = vec![None; trains];
            for &train in order {
                routes[train] =
                    self.beside(train, profiles, &routes, None, (share, limits.1), outline);
            }
            let revenue = Outline::value(&routes, self.problem.longest_route_bonus_per_stop);
            if revenue > outline.revenue {
                outline.revenue = revenue;
                outline.routes = routes;
            }
        }
        self.improve(profiles, outline, limits);
    }

    /// The train's best route beside the other trains' routes and worth more than the floor: its
    /// best route alone where that is clear of them.
    fn beside(
        &self,
        train: usize,
        profiles: &[Rc<Profile>],
        routes: &[Option<Lone>],
        floor: Option<i32>,
        limits: (Limit, usize),
        outline: &mut Outline,
    ) -> Option<Lone> {
        let mut closed = vec![0; self.problem.resource_count.div_ceil(64)];
        let others = routes
            .iter()
            .enumerate()
            .filter(|&(other, _)| other != train);
        let others: Vec<&Lone> = others.flat_map(|(_, lone)| lone).collect();
        for lone in &others {
            for (closed, track) in closed.iter_mut().zip(&lone.track) {
                *closed |= track;
            }
        }
        // A quota of more routes than the others take of it is open to this one.
        for quota in &self.problem.quotas {
            let (word, bit) = (quota.piece / 64, quota.piece % 64);
            let held = others
                .iter()
                .filter(|lone| lone.track[word] >> bit & 1 == 1)
                .count();
            if held < quota.routes {
                closed[word] &= !(1 << bit);
            }
        }
        match &outline.bests[train] {
            Some(best) if best.track.iter().zip(&closed).all(|(a, b)| a & b == 0) => {
                Some(best.clone())
            }
            Some(_) if !limits.0.reached(self.taken.get()) => {
                self.lone(
                    train,
                    &profiles[train],
                    Some(&closed),
                    floor,
                    limits,
                    outline,
                )
                .0
            }
            _ => None,
        }
    }

    /// Each train in turn takes its best route beside the others' while that earns more.
    fn improve(&self, profiles: &[Rc<Profile>], outline: &mut Outline, limits: (Limit, usize)) {
        let longest_bonus = self.problem.longest_route_bonus_per_stop;
        let most = outline.most();
        let mut improved = true;
        while improved && most.is_none_or(|most| i64::from(outline.revenue) < most) {
            improved = false;
            for train in 0..self.problem.trains.len() {
                let running = outline.routes[train].as_ref();
                let worth =
                    running.map_or(0, |lone| lone.revenue + lone.visits as i32 * longest_bonus);
                if outline.alone[train].is_some_and(|alone| worth >= alone) {
                    continue;
                }
                // Where the longest route earns more, a route worth less may yet add to it.
                let floor = (longest_bonus == 0).then_some(worth);
                let routes = std::mem::take(&mut outline.routes);
                let route = self.beside(train, profiles, &routes, floor, limits, outline);
                outline.routes = routes;
                let before = std::mem::replace(&mut outline.routes[train], route);
                let revenue = Outline::value(&outline.routes, longest_bonus);
                if revenue > outline.revenue {
                    outline.revenue = revenue;
                    improved = true;
                } else {
                    outline.routes[train] = before;
                }
            }
        }
    }

    /// Settles two trains whose best routes share track, exactly: in any operation one of them
    /// keeps off a piece both run on, so the piece is closed to each in turn and that train
    /// routed again. A split's routes bound what any operation within its closed track earns;
    /// once they run clear of each other they are the best within it. The most promising split
    /// is taken up first, which proves the operation soonest. With patience given the search
    /// is after better operations, which come of the routes deep in a split: each split is
    /// followed down, the better of its two parts at once, until so many routings have passed
    /// without a better operation. True when no split left could earn more than the outline's
    /// operation; false when the time, memory or patience is up.
    fn settle(
        &self,
        profiles: &[Rc<Profile>],
        outline: &mut Outline,
        settling: &mut Settling,
        limits: (Limit, usize),
        patience: Option<usize>,
    ) -> bool {
        let spent = |settling: &Settling| {
            patience.is_some_and(|patience| settling.idle >= patience)
                || settling.bytes > limits.1
                || limits.0.reached(self.taken.get())
        };
        loop {
            if spent(settling) {
                return false;
            }
            let Some(mut split) = settling.splits.pop() else {
                return true;
            };
            if split.bound <= outline.revenue {
                return true;
            }
            loop {
                let Some(mut parts) = self.divide(profiles, outline, settling, limits, &split)
                else {
                    // The split is taken up again when the search goes on.
                    settling.splits.push(split);
                    return false;
                };
                parts.sort_by_key(|part| part.bound);
                let Some(better) = parts.pop() else {
                    break;
                };
                settling.splits.extend(parts);
                if better.bound <= outline.revenue {
                    break;
                }
                if spent(settling) {
                    settling.splits.push(better);
                    return false;
                }
                split = better;
            }
        }
    }

    /// Takes up one split: its routes run clear of each other and are an operation, or the first
    /// piece both run on is closed to each train in turn, giving a split for each whose route
    /// clear of it could still be part of a better operation. Each such route also makes an
    /// operation with the other train's best route clear of all of it. None when a routing ran
    /// out of time.
    fn divide(
        &self,
        profiles: &[Rc<Profile>],
        outline: &mut Outline,
        settling: &mut Settling,
        limits: (Limit, usize),
        split: &Split,
    ) -> Option<Vec<Split>> {
        let Some(piece) = split.routes[0]
            .track
            .iter()
            .zip(&split.routes[1].track)
            .enumerate()
            .find(|(_, (first, second))| *first & *second != 0)
            .map(|(word, (first, second))| word * 64 + (first & second).trailing_zeros() as usize)
        else {
            outline.revenue = split.bound;
            outline.routes = split
                .routes
                .iter()
                .map(|lone| Some(Lone::clone(lone)))
                .collect();
            settling.idle = 0;
            return Some(vec![]);
        };
        let mut parts = vec![];
        // Alike trains are told apart only by the first piece closed to one of them.
        let trains = if settling.alike && split.depth == 0 {
            1
        } else {
            2
        };
        for train in 0..trains {
            settling.idle += 1;
            let other = &split.routes[1 - train];
            let mut closed = Vec::clone(&split.closed[train]);
            closed[piece / 64] |= 1 << (piece % 64);
            let (route, finished) = self.lone(
                train,
                &profiles[train],
                Some(&closed),
                Some(outline.revenue - other.revenue),
                limits,
                outline,
            );
            if !finished {
                return None;
            }
            let Some(route) = route else {
                continue;
            };
            if !other
                .track
                .iter()
                .zip(&route.track)
                .all(|(theirs, ours)| theirs & ours == 0)
            {
                let (beside, _) = self.lone(
                    1 - train,
                    &profiles[1 - train],
                    Some(&route.track),
                    Some(outline.revenue - route.revenue),
                    limits,
                    outline,
                );
                if let Some(beside) = beside {
                    outline.revenue = route.revenue + beside.revenue;
                    outline.routes = vec![None, None];
                    outline.routes[train] = Some(route.clone());
                    outline.routes[1 - train] = Some(beside);
                    settling.idle = 0;
                }
            }
            let mut part = Split {
                bound: route.revenue + other.revenue,
                depth: split.depth + 1,
                closed: split.closed.clone(),
                routes: split.routes.clone(),
            };
            settling.bytes += std::mem::size_of::<Split>()
                + 2 * (closed.len() * std::mem::size_of::<u64>() + 4 * ALLOCATION)
                + route.bytes();
            part.closed[train] = Rc::new(closed);
            part.routes[train] = Rc::new(route);
            parts.push(part);
        }
        Some(parts)
    }

    fn profile(&self, train: &Train) -> Profile {
        let problem = self.problem;
        let mut token_distance = vec![u32::MAX; problem.stops.len()];
        for (id, stop) in problem.stops.iter().enumerate() {
            if stop.token {
                token_distance[id] = 0;
            }
        }
        for _ in 0..problem.stops.len() {
            let mut changed = false;
            for edge in self.connections {
                let stop = &problem.stops[edge.to];
                if stop.blocked
                    && !stop.token
                    && !((stop.city || stop.town)
                        && (problem.blocked_passes > 0 || train.blocked_passes > 0))
                {
                    continue;
                }
                let distance = token_distance[edge.to].saturating_add(
                    train
                        .passing_cost(edge.to)
                        .saturating_add(train.crossing_cost(edge)),
                );
                if distance < token_distance[edge.from] {
                    token_distance[edge.from] = distance;
                    changed = true;
                }
            }
            if !changed {
                break;
            }
        }
        Profile {
            ranked: std::cell::OnceCell::new(),
            outlook: outlook::Outlook::new(problem, self.connections, train),
            token_distance,
        }
    }

    // Lists a train's routes, leaving stored candidates deduplicated and sorted by revenue.
    fn search<'b>(&self, train: &'b Train, plan: SearchPlan<'b>) -> Search<'b>
    where
        'a: 'b,
    {
        let problem = self.problem;
        // One best route is searched for with the stops that pay most first; every route is
        // listed in the order the track was compiled.
        let ranked = plan.best_only.then(|| {
            let (order, rules) = plan.profile.ranked.get_or_init(|| {
                let (order, rules) =
                    alike::order(problem, self.connections, self.stays, self.adjacency, train);
                (Rc::new(order), Rc::new(rules))
            });
            (Rc::clone(order), Rc::clone(rules))
        });
        let goes_on = plan.listed.is_some();
        let scanned = plan.streaming.as_ref().map_or(0, |stream| stream.scans);
        let (candidates, resume) = plan
            .listed
            .unwrap_or_else(|| (Candidates::new(*self), Resume::default()));
        let mut search = Search {
            problem,
            connections: self.connections,
            stays: self.stays,
            adjacency: self.adjacency,
            departures: self.departures,
            quotas: self.quotas,
            train,
            profile: plan.profile,
            origins: hex_flags(problem, train.interconnections.iter().flat_map(|i| &i.from)),
            destinations: hex_flags(problem, train.interconnections.iter().flat_map(|i| &i.to)),
            extension_parents: if train.interconnections.is_empty() {
                vec![]
            } else {
                vec![UNREACHED; problem.arcs.len() * problem.stretch_states()]
            },
            stretch_states: problem.stretch_states(),
            used: plan
                .closed
                .unwrap_or_else(|| vec![0; problem.resource_count.div_ceil(64)]),
            visited: vec![false; problem.stops.len()],
            groups: vec![false; problem.group_count],
            hexes: vec![0; problem.hex_bonuses.len()],
            been: vec![false; problem.hex_bonuses.len()],
            walking: vec![],
            every_stop_costs: (0..problem.stops.len()).all(|id| train.passing_cost(id) > 0),
            candidates,
            streaming: plan.streaming,
            count: 0,
            expansions: 0,
            best_only: plan.best_only,
            deadline: plan.limit.deadline,
            steps: plan.limit.steps.saturating_sub(self.taken.get()),
            taken: self.taken,
            stepped: 0,
            weighed: 0,
            scanned,
            exhausted: false,
            resume: resume.path,
            cut: Resume::default(),
            when_full: plan.when_full,
            full: false,
            partners: vec![0; problem.stops.len() + 2],
            sought: 0,
            tracks: vec![],
            caps: vec![i32::MAX; problem.stops.len() + 2],
            memory_budget: plan.memory_budget,
            selection_bytes_per_candidate: plan.selection_bytes_per_candidate,
            floor: plan.floor,
            limited: false,
            // A train may stay idle, so its best is never below nothing.
            max_value: 0,
            // Only where the one best route is kept, and no extension needs track of its own.
            alike: ranked
                .as_ref()
                .filter(|_| train.interconnections.is_empty())
                .map(|(_, rules)| alike::Alike::new(problem, Rc::clone(rules))),
            bonus_left: problem.hex_bonuses.iter().map(|&bonus| bonus.max(0)).sum(),
            amounts: vec![],
            stretch: 0,
            cuts: 0,
            shut: vec![vec![]; problem.stops.len() + 1],
            plain: !train.scores_payments() && !train.calls_selectively() && !train.subsidizes(),
        };
        // A quota that holds no route, or whose piece is closed, closes its group's stops.
        for quota in &problem.quotas {
            if quota.routes == 0 || search.used[quota.piece / 64] >> (quota.piece % 64) & 1 == 1 {
                search.groups[quota.group] = true;
            }
        }
        let mut starts: Vec<usize> = (0..problem.stops.len()).collect();
        if plan.best_only {
            starts.sort_by_key(|&id| std::cmp::Reverse(train.revenues[id]));
        }
        for (place, id) in starts.into_iter().enumerate().skip(resume.start) {
            let stop = &problem.stops[id];
            if stop.allowed && stop.endpoint && !stop.groups.iter().any(|&g| search.groups[g]) {
                if let Some(alike) = &mut search.alike {
                    alike.start(stop.hex);
                }
                // The route runs on its first stop's quotas from the start.
                for &piece in self.quotas_at(id) {
                    search.used[piece / 64] |= 1 << (piece % 64);
                }
                search.been[stop.hex] = problem.tracks_reentry();
                search.walk(
                    ranked.as_ref().map(|(order, _)| order.as_ref()),
                    id,
                    id,
                    RouteValue {
                        cost: train.visit_costs[id],
                        places: 0,
                        majors: train.majors(stop),
                        revenue: 0,
                        token: false,
                        city: false,
                        first_bonus: 0,
                        last_bonus: 0,
                        passes: 0,
                        collected: 0,
                        unpaid: 0,
                    },
                );
                search.been[stop.hex] = false;
                for &piece in self.quotas_at(id) {
                    search.used[piece / 64] &= !(1 << (piece % 64));
                }
            }
            if search.exhausted {
                // What the walk had not come back to of an earlier listing's route lies beyond
                // where this one stopped.
                search.cut.start = place;
                let reached = std::mem::take(&mut search.cut.path);
                search.cut.path = std::mem::take(&mut search.resume);
                search.cut.path.extend(reached);
                break;
            }
            search.resume.clear();
        }
        self.taken.set(self.taken.get() + search.steps_taken());
        // A listing that goes on is put in order when it is through, if the time allows: that
        // cannot be cut short. With too little left it stands as one that stopped at its end.
        if goes_on
            && !search.exhausted
            && milliseconds() + search.candidates.len() as f64 * ORDERING_MS > plan.limit.deadline
        {
            search.exhausted = true;
            search.cut.start = usize::MAX;
        }
        if goes_on && search.exhausted {
            return search;
        }
        search.candidates.dedup(*self);
        search.candidates.rank();
        // A listing that will go on keeps its room: see `reclaim`.
        if !search.exhausted {
            search
                .candidates
                .shrink(plan.selection_bytes_per_candidate, plan.memory_budget);
        }
        search
    }
}

// An earlier train whose candidates are the same as this one's.
fn same_profile(problem: &Problem, train_id: usize) -> Option<usize> {
    let train = &problem.trains[train_id];
    problem.trains[..train_id].iter().position(|other| {
        other.fleet == train.fleet
            && other.allowed_stops == train.allowed_stops
            && other.distance == train.distance
            && other.visit_costs == train.visit_costs
            && other.crossing_costs == train.crossing_costs
            && other.requires_city == train.requires_city
            && other.revenues == train.revenues
            && other.first_bonus == train.first_bonus
            && other.paying_stop_limit == train.paying_stop_limit
            && other.uncounted == train.uncounted
            && other.blocked_passes == train.blocked_passes
            && other.require_paying_token == train.require_paying_token
            && other.bonuses_along_route == train.bonuses_along_route
            && other.connection_bonuses == train.connection_bonuses
            && other.major_limit == train.major_limit
            && other.interconnections == train.interconnections
            && other.optional == train.optional
            && other.subsidies == train.subsidies
    })
}

fn hex_flags<'a>(problem: &Problem, hexes: impl Iterator<Item = &'a usize>) -> Vec<bool> {
    let mut flags = vec![false; problem.hex_bonuses.len()];
    for &hex in hexes {
        flags[hex] = true;
    }
    flags
}

pub fn solve_json(input: &[u8]) -> Vec<u8> {
    let result = serde_json::from_slice::<Problem>(input)
        .map_err(|e| e.to_string())
        .and_then(solve);
    match result {
        Ok(solution) => serde_json::to_vec(&solution).unwrap(),
        Err(error) => serde_json::to_vec(&serde_json::json!({"error": error})).unwrap(),
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm;

#[cfg(test)]
mod pruning;

#[cfg(test)]
mod tests {
    use super::*;

    struct Tracks {
        problem: Problem,
        connections: Vec<Connection>,
        taken: std::cell::Cell<u64>,
    }

    impl Tracks {
        fn new() -> Self {
            Self {
                problem: serde_json::from_value(serde_json::json!({
                    "version": 12, "stops": [], "arcs": [], "trains": [],
                    "resource_count": 130, "junction_count": 0, "group_count": 0,
                    "hex_bonuses": [], "budget_ms": 30000, "memory_budget_bytes": 65536,
                }))
                .unwrap(),
                connections: (0..130)
                    .map(|id| Connection {
                        from: id,
                        to: id + 1,
                        paths: vec![id],
                        resources: vec![id],
                        hexes: vec![],
                        first_terminal: false,
                        last_terminal: false,
                        departs_terminal: false,
                        crossings: 0,
                        gauge: Stretch::Standard,
                    })
                    .collect(),
                taken: std::cell::Cell::new(0),
            }
        }

        fn network(&self) -> Network<'_> {
            Network {
                problem: &self.problem,
                connections: &self.connections,
                stays: &[],
                adjacency: &[],
                departures: &[],
                quotas: &[],
                taken: &self.taken,
            }
        }
    }

    fn add(candidates: &mut Candidates, revenue: i32, connections: &[usize], extension: &[usize]) {
        candidates.push(CandidateView {
            revenue,
            visits: connections.len() + 1,
            connections,
            resources: &[],
            reversed: false,
            extension,
        });
    }

    #[test]
    fn interrupted_streaming_finishes_its_first_partner_search_and_keeps_the_pair() {
        let mut tracks = Tracks::new();
        tracks.problem.memory_budget_bytes = 4 * 1024 * 1024;
        let network = tracks.network();
        let mut stored = Candidates::new(network);
        for index in 0..4096 {
            add(&mut stored, 100, &[usize::from(index == 4095)], &[]);
        }
        let stored = Rc::new(stored);
        let partial = stored.bytes(0) + network.streaming_scratch_bytes() + 20_000;
        for budget in [0, partial, usize::MAX] {
            let mut selection = StreamingSelection::new(Rc::clone(&stored), network, -1.0, budget);
            if budget == partial {
                assert!(selection.resource_candidates.words > 0);
                assert!(selection.resource_candidates.words < stored.len() / 64);
            }
            selection.offer(
                CandidateView {
                    revenue: 100,
                    visits: 2,
                    connections: &[0],
                    resources: &[1, 0, 0],
                    reversed: false,
                    extension: &[],
                },
                0,
            );
            assert!(!selection.exhausted);
            assert_eq!(selection.checks, 4096);
            assert_eq!(selection.revenue, 200);
            assert_eq!(selection.best_stored, Some(4095));
            selection.offer(
                CandidateView {
                    revenue: 101,
                    visits: 3,
                    connections: &[0, 1],
                    resources: &[3, 0, 0],
                    reversed: false,
                    extension: &[],
                },
                0,
            );
            assert!(selection.exhausted);
            assert_eq!(selection.checks, 5120);
            assert_eq!(selection.revenue, 200);
            let partner = stored.route(selection.best_stored.unwrap(), 0, network);
            assert_eq!(partner.connections[0].paths, [1]);
            assert_eq!(
                selection.best_streamed.unwrap().route.connections[0].paths,
                [0]
            );
        }
    }

    #[test]
    fn streaming_continues_past_a_compatible_partner_for_a_larger_longest_bonus() {
        let mut tracks = Tracks::new();
        tracks.problem.longest_route_bonus_per_stop = 300;
        let network = tracks.network();
        let mut stored = Candidates::new(network);
        add(&mut stored, 100, &[0], &[]);
        add(&mut stored, 0, &[1, 1, 1, 1], &[]);
        let stored = Rc::new(stored);
        for budget in [0, usize::MAX] {
            let mut selection =
                StreamingSelection::new(Rc::clone(&stored), network, f64::INFINITY, budget);
            assert!(selection.wanted(1000, 2, 0, i32::MAX));
            selection.offer(
                CandidateView {
                    revenue: 1000,
                    visits: 2,
                    connections: &[2],
                    resources: &[4, 0, 0],
                    reversed: false,
                    extension: &[],
                },
                0,
            );
            assert_eq!(selection.revenue, 2500);
            assert_eq!(selection.best_stored, Some(1));
            assert!(!selection.wanted(900, 2, 0, i32::MAX));
        }
    }

    #[test]
    fn streaming_pairs_no_route_with_a_stored_one_that_begins_under_the_same_quota() {
        let tracks = Tracks::new();
        let quota = 129;
        let quotas: Vec<Vec<usize>> = (0..131)
            .map(|stop| if stop == 0 { vec![quota] } else { vec![] })
            .collect();
        let network = Network {
            quotas: &quotas,
            ..tracks.network()
        };
        let mut stored = Candidates::new(network);
        add(&mut stored, 100, &[0], &[]);
        add(&mut stored, 40, &[5], &[]);
        let stored = Rc::new(stored);
        let mut resources = [0; 3];
        for piece in [10, quota] {
            resources[piece / 64] |= 1 << (piece % 64);
        }
        for budget in [0, usize::MAX] {
            let mut selection =
                StreamingSelection::new(Rc::clone(&stored), network, f64::INFINITY, budget);
            assert_eq!(selection.resource_candidates.words, usize::from(budget > 0));
            selection.offer(
                CandidateView {
                    revenue: 50,
                    visits: 2,
                    connections: &[10],
                    resources: &resources,
                    reversed: false,
                    extension: &[],
                },
                0,
            );
            assert_eq!(selection.revenue, 100);
            selection.offer(
                CandidateView {
                    revenue: 70,
                    visits: 2,
                    connections: &[10],
                    resources: &resources,
                    reversed: false,
                    extension: &[],
                },
                0,
            );
            assert_eq!(selection.revenue, 110);
            assert_eq!(selection.best_stored, Some(1));
        }
    }

    #[test]
    fn interrupted_selection_stops_after_a_first_descent_that_ends_at_a_bound() {
        let tracks = Tracks::new();
        let network = tracks.network();
        let mut routes = Candidates::new(network);
        for index in 0..4096 {
            add(&mut routes, 10_000 - index, &[0], &[]);
        }
        let shared = Rc::new(routes);
        let candidates = [Rc::clone(&shared), shared];
        let mut selection = Selection::new(&candidates, network, Limit::until(-1.0), usize::MAX);
        selection.walk(0, 0, 0);
        assert!(selection.exhausted);
        assert_eq!(selection.revenue, 10_000);
        assert!(
            selection.expansions < 2048,
            "{} expansions",
            selection.expansions
        );
    }

    #[test]
    fn arena_reuses_space_after_cuts_and_preserves_extensions_and_direction() {
        let mut tracks = Tracks::new();
        tracks.problem.arcs = serde_json::from_value(serde_json::json!([
            {"from": 2, "to": 3, "next": [], "resources": [129], "junctions": [],
             "path": 99, "hex": 0, "terminal": false, "crossings": 0}
        ]))
        .unwrap();
        let network = tracks.network();
        let mut stored = Candidates::new(network);
        add(&mut stored, 10, &[0, 1, 2], &[]);
        add(&mut stored, 30, &[2, 1], &[0]);
        stored.entries[1].reversed = true;
        add(&mut stored, 20, &[3], &[]);
        let route = serde_json::to_value(stored.route(1, 0, network)).unwrap();
        let capacity = stored.arena.capacity();
        stored
            .entries
            .sort_unstable_by_key(|c| std::cmp::Reverse(c.revenue));
        stored.entries.truncate(1);
        stored.compact();
        assert_eq!(stored.arena.len(), 3);
        assert_eq!(
            serde_json::to_value(stored.route(0, 0, network)).unwrap(),
            route
        );
        assert_eq!(
            stored.resources(&stored[0], network).collect::<Vec<_>>(),
            [2, 1, 129]
        );
        assert_eq!(route["extension"], serde_json::json!([99]));
        for _ in 0..100 {
            add(&mut stored, 1, &[3, 4, 5], &[]);
            stored.entries.truncate(1);
            stored.compact();
        }
        assert_eq!(stored.arena.capacity(), capacity);
        assert_eq!(stored.arena.len(), 3);
    }

    #[test]
    fn dedup_checks_hash_collisions_exactly_and_reclaims_discarded_ids() {
        let mut tracks = Tracks::new();
        tracks.problem.longest_route_bonus_per_stop = 10;
        tracks.connections[3].resources = vec![0, 64];
        tracks.problem.arcs = serde_json::from_value(serde_json::json!([
            {"from": 2, "to": 3, "next": [], "resources": [129], "junctions": [],
             "path": 99, "hex": 0, "terminal": false, "crossings": 0}
        ]))
        .unwrap();
        let network = tracks.network();
        let mut stored = Candidates::new(network);
        add(&mut stored, 10, &[0, 64], &[]);
        add(&mut stored, 20, &[64, 0], &[]);
        add(&mut stored, 30, &[1, 64], &[]);
        add(&mut stored, 40, &[3], &[]);
        add(&mut stored, 50, &[0, 64], &[0]);
        add(&mut stored, 60, &[64, 0], &[0]);
        stored.dedup_by_hash(network, |_| 0);
        assert_eq!(
            stored.iter().map(|c| c.revenue).collect::<Vec<_>>(),
            [20, 30, 40, 60]
        );
        assert_eq!(stored.arena.len(), 8);
        tracks.problem.longest_route_bonus_per_stop = 0;
        stored.dedup_by_hash(tracks.network(), |_| 0);
        assert_eq!(
            stored.iter().map(|c| c.revenue).collect::<Vec<_>>(),
            [30, 40, 60]
        );
        assert_eq!(stored.arena.len(), 6);
    }

    #[test]
    fn arena_uses_u16_at_the_boundary_and_wide_ids_beyond_it() {
        for (count, width) in [(65536, 2), (65537, std::mem::size_of::<usize>())] {
            let mut arena = IdArena::new(count);
            arena.extend(&[0, 65535, count - 1]);
            assert_eq!(arena.id_bytes(), width);
            assert_eq!(arena.ids(0..3).collect::<Vec<_>>(), [0, 65535, count - 1]);
            arena.copy_within(1..3, 0);
            arena.truncate(2);
            assert_eq!(arena.ids(0..2).collect::<Vec<_>>(), [65535, count - 1]);
        }
    }

    #[test]
    fn growth_accounting_covers_old_allocations_and_dedup_scratch() {
        let tracks = Tracks::new();
        let network = tracks.network();
        let mut stored = Candidates::new(network);
        for count in 0..200 {
            let before = stored.bytes(7);
            let old_entries = stored.entries.capacity();
            let old_arena = stored.arena.capacity();
            let peak = stored.growth_peak(3, 7, tracks.problem.resource_count);
            add(&mut stored, count, &[0, 1, 2], &[]);
            let after = stored.bytes(7);
            assert!(peak >= after + Candidates::dedup_bytes(tracks.problem.resource_count));
            if stored.entries.capacity() != old_entries {
                assert!(
                    peak >= before
                        + stored.entries.capacity() * std::mem::size_of::<Candidate>()
                        + ALLOCATION
                );
            }
            if stored.arena.capacity() != old_arena {
                assert!(peak >= after + old_arena * stored.arena.id_bytes() + ALLOCATION);
            }
        }
        stored.dedup(network);
        assert_eq!(stored.len(), 1);
        assert_eq!(stored.arena.len(), 3);
    }

    #[test]
    fn resource_index_budget_includes_row_headers_and_allocations() {
        for resources in [0, 1, 130, 502] {
            for budget in [0, 32, 4096, 65536] {
                let words = ResourceCandidates::words_for_budget(resources, budget);
                let index = ResourceCandidates::new(resources, words);
                let bytes = if index.rows.is_empty() {
                    0
                } else {
                    index.rows.capacity() * std::mem::size_of::<Vec<u64>>()
                        + ALLOCATION
                        + index
                            .rows
                            .iter()
                            .map(|row| row.capacity() * std::mem::size_of::<u64>() + ALLOCATION)
                            .sum::<usize>()
                };
                assert!(bytes <= budget);
                if words > 0 {
                    assert!(bytes + resources * std::mem::size_of::<u64>() > budget);
                }
            }
        }
    }
}
