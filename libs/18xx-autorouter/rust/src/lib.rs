use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use std::rc::Rc;

#[derive(Deserialize)]
pub struct Problem {
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
    budget_ms: f64,
    memory_budget_bytes: usize,
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
    terminal: bool,
    crossings: u32,
}

#[derive(Deserialize, PartialEq)]
struct Train {
    id: String,
    distance: u32,
    counts_crossings: bool,
    requires_city: bool,
    visit_costs: Vec<u32>,
    revenues: Vec<i32>,
    first_bonus: Vec<i32>,
    #[serde(default)]
    paying_stop_limit: Option<usize>,
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
}

#[derive(Deserialize, PartialEq)]
struct PaidConnectionBonus {
    from: Vec<Option<i32>>,
    to: Vec<Option<i32>>,
    #[serde(default)]
    ends_only: bool,
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
    fn paid_revenue(&self, payment: &Payment) -> i32 {
        let visits = payment.visits;
        let count = self
            .paying_stop_limit
            .unwrap_or(visits.len())
            .min(visits.len());
        if count == visits.len() {
            return self.selected_revenue(payment, visits);
        }
        let mut best = 0;
        self.select_payments(payment, 0, count, &mut Vec::new(), &mut best);
        best
    }

    fn select_payments(
        &self,
        payment: &Payment,
        start: usize,
        count: usize,
        selected: &mut Vec<usize>,
        best: &mut i32,
    ) {
        if selected.len() == count {
            if !self.require_paying_token || selected.iter().any(|&id| payment.stops[id].token) {
                *best = (*best).max(self.selected_revenue(payment, selected));
            }
            return;
        }
        for index in start..=payment.visits.len() - (count - selected.len()) {
            selected.push(payment.visits[index]);
            self.select_payments(payment, index + 1, count, selected, best);
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
            || !self.connection_bonuses.is_empty()
            || !self.interconnections.is_empty()
    }

    fn majors(&self, stop: &Stop) -> u32 {
        u32::from(self.major_limit.is_some() && !stop.town)
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
    crossings: u32,
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

    fn resources<'a>(
        &'a self,
        candidate: &Candidate,
        network: Network<'a>,
    ) -> impl Iterator<Item = usize> + use<'a> {
        self.connection_ids(candidate)
            .flat_map(move |id| network.connections[id].resources.iter().copied())
            .chain(
                self.extension_ids(candidate)
                    .flat_map(move |id| network.problem.arcs[id].resources.iter().copied()),
            )
    }

    fn resource_bits(&self, candidate: &Candidate, network: Network<'_>, bits: &mut [u64]) {
        bits.fill(0);
        for resource in self.resources(candidate, network) {
            bits[resource / 64] |= 1 << (resource % 64);
        }
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

#[derive(Serialize)]
struct Route {
    train: usize,
    connections: Vec<RouteConnection>,
    extension: Vec<usize>,
}

#[derive(Serialize)]
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
    if problem.version != 6
        || !problem.budget_ms.is_finite()
        || problem.budget_ms <= 0.0
        || problem.memory_budget_bytes == 0
    {
        return Err("Unsupported problem version or budget".into());
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
            || arc.terminal != reverse.terminal
            || arc
                .next
                .iter()
                .any(|&next| !problem.arcs[next ^ 1].next.contains(&(id ^ 1)))
        {
            return Err("Track connectivity must be reversible".into());
        }
    }
    for train in &problem.trains {
        if train.visit_costs.len() != n
            || train.paying_stop_limit == Some(0)
            || train.connection_bonuses.iter().any(|bonus| {
                bonus.from.len() != n
                    || bonus.to.len() != n
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
            || train
                .revenues
                .iter()
                .chain(&train.first_bonus)
                .any(|&r| r < 0)
        {
            return Err("Unsupported train revenue profile".into());
        }
    }
    if problem.longest_route_bonus_per_stop < 0 || problem.hex_bonuses.iter().any(|&b| b < 0) {
        return Err("Negative hex bonus".into());
    }
    Ok(())
}

struct Compiler<'a> {
    problem: &'a Problem,
    used: Vec<bool>,
    junction_segments: Vec<u8>,
    walking: Vec<usize>,
    connections: Vec<Connection>,
    deadline: f64,
    expansions: u64,
    exhausted: bool,
    // Bytes the connections and their adjacency entries may take before compilation stops.
    memory_budget: usize,
    stored_bytes: usize,
    limited: bool,
}

impl Compiler<'_> {
    fn walk(&mut self, from: usize, arc_id: usize) {
        self.expansions += 1;
        if self.exhausted
            || (self.expansions == 1 || self.expansions.is_multiple_of(4096))
                && milliseconds() > self.deadline
        {
            self.exhausted = true;
            return;
        }
        let arc = &self.problem.arcs[arc_id];
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
                if !interior_terminal {
                    let mut resources: Vec<_> = self
                        .walking
                        .iter()
                        .flat_map(|&a| self.problem.arcs[a].resources.iter().copied())
                        .collect();
                    resources.sort_unstable();
                    resources.dedup();
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
                        crossings: self
                            .walking
                            .iter()
                            .map(|&a| self.problem.arcs[a].crossings)
                            .sum(),
                    };
                    let bytes = connection_bytes(&connection);
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
                    }
                }
            }
        } else {
            for &next in &arc.next {
                self.walk(from, next);
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
    majors: u32,
    revenue: i32,
    token: bool,
    city: bool,
    first_bonus: i32,
    last_bonus: i32,
}

struct Search<'a> {
    problem: &'a Problem,
    connections: &'a [Connection],
    adjacency: &'a [Vec<usize>],
    departures: &'a [Vec<usize>],
    train: &'a Train,
    token_distance: Vec<u32>,
    origins: Vec<bool>,
    destinations: Vec<bool>,
    extension_parents: Vec<usize>,
    used: Vec<u64>,
    visited: Vec<bool>,
    groups: Vec<bool>,
    hexes: Vec<u32>,
    walking: Vec<usize>,
    // Every stop uses some of the train's capacity, so a full train cannot continue.
    every_stop_costs: bool,
    candidates: Candidates,
    streaming: Option<StreamingSelection<'a>>,
    count: usize,
    expansions: u64,
    best_only: bool,
    deadline: f64,
    exhausted: bool,
    // Bytes the stored candidates may take, counting their share of the selection's tables.
    memory_budget: usize,
    selection_bytes_per_candidate: usize,
    // Once the budget is reached, only candidates worth more than the weakest one kept are stored.
    floor: Option<i32>,
    limited: bool,
    // The most valuable route the train can run (0 when it has none), once the search has finished.
    max_value: i32,
}

const UNREACHED: usize = usize::MAX;
const EXTENSION_ROOT: usize = usize::MAX - 1;

impl Search<'_> {
    fn walk(&mut self, start: usize, node: usize, value: RouteValue) {
        let RouteValue {
            cost,
            majors,
            revenue,
            token,
            city,
            first_bonus,
            last_bonus,
        } = value;
        self.expansions += 1;
        if self.exhausted
            || (self.expansions == 1 || self.expansions.is_multiple_of(4096))
                && milliseconds() > self.deadline
        {
            self.exhausted = true;
            return;
        }
        let stop = &self.problem.stops[node];
        if cost > self.train.distance || self.train.major_limit.is_some_and(|limit| majors > limit)
        {
            return;
        }
        let token = token || stop.token;
        let city = city || stop.city;
        if !token && self.token_distance[node] > self.train.distance - cost {
            return;
        }
        let revenue = revenue + self.train.revenues[node];
        let bonus = self.train.first_bonus[node];
        let first_bonus = if first_bonus != 0 { first_bonus } else { bonus };
        let last_bonus = if bonus != 0 { bonus } else { last_bonus };
        if node > start && token && stop.endpoint && (!self.train.requires_city || city) {
            self.record(start, node, revenue, first_bonus, last_bonus);
        }
        if !self.walking.is_empty()
            && (stop.blocked
                || (self.connections[*self.walking.last().unwrap()].last_terminal
                    && !(self.walking.len() == 1
                        && self.connections[self.walking[0]].paths.len() == 1)))
        {
            return;
        }
        self.visited[node] = true;
        for &g in &stop.groups {
            self.groups[g] = true;
        }
        // A full train goes no further unless some stop is free to visit.
        if cost == self.train.distance && self.every_stop_costs {
            for &g in &stop.groups {
                self.groups[g] = false;
            }
            self.visited[node] = false;
            return;
        }
        for &connection_id in &self.adjacency[node] {
            let edge = &self.connections[connection_id];
            let next = &self.problem.stops[edge.to];
            // The step the next call would reject at once, checked first and before touching any
            // state.
            let next_cost = cost
                + self.train.visit_costs[edge.to]
                + if self.train.counts_crossings {
                    edge.crossings
                } else {
                    0
                };
            let next_majors = majors + self.train.majors(next);
            if next_cost > self.train.distance
                || self
                    .train
                    .major_limit
                    .is_some_and(|limit| next_majors > limit)
                || !(token || next.token)
                    && self.token_distance[edge.to] > self.train.distance - next_cost
            {
                continue;
            }
            if self.visited[edge.to]
                || next.groups.iter().any(|&g| self.groups[g])
                || edge.first_terminal && !self.walking.is_empty() && edge.paths.len() > 1
                || edge
                    .resources
                    .iter()
                    .any(|&r| self.used[r / 64] & (1 << (r % 64)) != 0)
            {
                continue;
            }
            for &r in &edge.resources {
                self.used[r / 64] |= 1 << (r % 64);
            }
            let mut extra = 0;
            for &h in &edge.hexes {
                if self.hexes[h] == 0 {
                    extra += self.problem.hex_bonuses[h];
                }
                self.hexes[h] += 1;
            }
            self.walking.push(connection_id);
            self.walk(
                start,
                edge.to,
                RouteValue {
                    cost: next_cost,
                    majors: next_majors,
                    revenue: revenue + extra,
                    token,
                    city,
                    first_bonus,
                    last_bonus,
                },
            );
            self.walking.pop();
            for &h in &edge.hexes {
                self.hexes[h] -= 1;
            }
            for &r in &edge.resources {
                self.used[r / 64] &= !(1 << (r % 64));
            }
            if self.exhausted {
                break;
            }
        }
        for &g in &stop.groups {
            self.groups[g] = false;
        }
        self.visited[node] = false;
    }

    fn record(
        &mut self,
        start: usize,
        end: usize,
        revenue: i32,
        first_bonus: i32,
        last_bonus: i32,
    ) {
        self.count += 1;
        let visits = self.walking.len() + 1;
        if !self.train.scores_payments() {
            self.offer(
                revenue + first_bonus.max(last_bonus),
                last_bonus > first_bonus,
                vec![],
            );
            return;
        }
        let problem = self.problem;
        let train = self.train;
        let stops: Vec<_> = std::iter::once(start)
            .chain(self.walking.iter().map(|&id| self.connections[id].to))
            .collect();
        let fixed = revenue - stops.iter().map(|&id| train.revenues[id]).sum::<i32>();
        let paid_revenue = |destination| {
            train.paid_revenue(&Payment {
                visits: &stops,
                stops: &problem.stops,
                destination,
            })
        };
        let paid = paid_revenue(None);
        self.offer(
            fixed + paid + first_bonus.max(last_bonus),
            last_bonus > first_bonus,
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
                if extended <= paid || !self.wanted(fixed + extended + first_stop_bonus, visits) {
                    continue;
                }
                self.offer(fixed + extended + first_stop_bonus, reversed, extension);
            }
        }
    }

    // Whether a candidate worth this much would be stored, checked before copying its lists.
    fn wanted(&mut self, revenue: i32, visits: usize) -> bool {
        self.max_value = self
            .max_value
            .max(revenue + visits as i32 * self.problem.longest_route_bonus_per_stop);
        if let Some(streaming) = &self.streaming {
            return streaming.wanted(revenue, visits);
        }
        let fleet_bonus = self.problem.longest_route_bonus_per_stop;
        let value = revenue + visits as i32 * fleet_bonus;
        if self.best_only {
            self.candidates
                .first()
                .is_none_or(|best| best.value(fleet_bonus) < value)
        } else {
            self.floor.is_none_or(|floor| value > floor)
        }
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
            streaming.offer(candidate);
            self.exhausted |= streaming.exhausted;
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
            if !self.best_only {
                self.reclaim();
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

    fn reclaim(&mut self) {
        self.candidates.dedup(Network {
            problem: self.problem,
            connections: self.connections,
            adjacency: self.adjacency,
            departures: self.departures,
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
        if payload + Candidates::dedup_bytes(self.problem.resource_count) > self.memory_budget / 2 {
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
        self.candidates
            .shrink(self.selection_bytes_per_candidate, self.memory_budget);
    }

    fn shortest_extensions(&mut self, from: usize) -> Vec<Vec<usize>> {
        let problem = self.problem;
        let departures = self.departures;
        let mut queue = vec![];
        for &arc in &departures[from] {
            if self.extends_along(arc) {
                self.extension_parents[arc] = EXTENSION_ROOT;
                queue.push(arc);
            }
        }
        let mut reached = vec![];
        let mut extensions = vec![];
        let mut head = 0;
        while let Some(&arc_id) = queue.get(head) {
            head += 1;
            let arc = &problem.arcs[arc_id];
            let following: &[usize] = match arc.to {
                None => &arc.next,
                Some(stop_id) => {
                    let stop = &problem.stops[stop_id];
                    if self.destinations[stop.hex] && !reached.contains(&stop.hex) {
                        let extension = self.extension_to(arc_id);
                        if is_simple_extension(problem, &extension) {
                            reached.push(stop.hex);
                            extensions.push(extension);
                        }
                    }
                    if stop.city || stop.town {
                        &departures[stop_id]
                    } else {
                        &[]
                    }
                }
            };
            for &next in following {
                if next != arc_id ^ 1
                    && self.extension_parents[next] == UNREACHED
                    && self.extends_along(next)
                {
                    self.extension_parents[next] = arc_id;
                    queue.push(next);
                }
            }
        }
        for arc in queue {
            self.extension_parents[arc] = UNREACHED;
        }
        extensions
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

    fn extension_to(&self, arc_id: usize) -> Vec<usize> {
        let mut extension = vec![arc_id];
        let mut current = arc_id;
        while self.extension_parents[current] != EXTENSION_ROOT {
            current = self.extension_parents[current];
            extension.push(current);
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
    stored: &'a Candidates,
    network: Network<'a>,
    connection_conflicts: Vec<u8>,
    extension_conflicts: Vec<u8>,
    resource_candidates: ResourceCandidates,
    longest_suffix: Vec<usize>,
    longest_bonus: i32,
    revenue: i32,
    best_stored: Option<usize>,
    best_streamed: Option<Route>,
    deadline: f64,
    checks: u64,
    next_clock_check: u64,
    descended: bool,
    exhausted: bool,
}

impl<'a> StreamingSelection<'a> {
    fn new(
        stored: &'a Candidates,
        network: Network<'a>,
        deadline: f64,
        memory_budget: usize,
    ) -> Self {
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
                .min(stored.len().div_ceil(64));
        let mut resource_candidates =
            ResourceCandidates::new(network.problem.resource_count, words);
        for (id, candidate) in stored.iter().take(words * 64).enumerate() {
            resource_candidates.insert(id, stored.resources(candidate, network));
        }
        let mut best_stored = None;
        let mut revenue = 0;
        for (id, candidate) in stored.iter().enumerate() {
            if candidate.value(longest_bonus) > revenue {
                revenue = candidate.value(longest_bonus);
                best_stored = Some(id);
            }
        }
        Self {
            stored,
            network,
            resource_candidates,
            connection_conflicts: vec![0; network.connections.len()],
            extension_conflicts: if stored.iter().any(|candidate| candidate.extension_len > 0) {
                vec![0; network.problem.arcs.len()]
            } else {
                vec![]
            },
            longest_suffix: longest_suffix(stored, longest_bonus),
            longest_bonus,
            revenue,
            best_stored,
            best_streamed: None,
            deadline,
            checks: 0,
            next_clock_check: 1024,
            descended: false,
            exhausted: false,
        }
    }

    fn upper(&self, revenue: i32, visits: usize, index: usize) -> i32 {
        revenue
            + self.stored.get(index).map_or(0, |c| c.revenue)
            + visits.max(self.longest_suffix.get(index).copied().unwrap_or(0)) as i32
                * self.longest_bonus
    }

    fn wanted(&self, revenue: i32, visits: usize) -> bool {
        !self.exhausted && self.upper(revenue, visits, 0) > self.revenue
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

    fn offer(&mut self, candidate: CandidateView<'_>) {
        self.connection_conflicts.fill(0);
        self.extension_conflicts.fill(0);
        let mut revenue = candidate.revenue + candidate.visits as i32 * self.longest_bonus;
        let mut partner = None;
        'partners: for word in 0..self.stored.len().div_ceil(64) {
            let start = word * 64;
            if self.upper(candidate.revenue, candidate.visits, start) <= self.revenue.max(revenue) {
                break;
            }
            let indexed = word < self.resource_candidates.words;
            let mut available = if indexed {
                self.checks += 64;
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
                if id >= self.stored.len()
                    || self.upper(candidate.revenue, candidate.visits, id)
                        <= self.revenue.max(revenue)
                {
                    break 'partners;
                }
                let stored = &self.stored[id];
                if !indexed {
                    self.checks += 1;
                    if self.timed_out() {
                        break 'partners;
                    }
                    let extension_start = stored.offset + stored.visits - 1;
                    if self.stored.arena.any(stored.offset..extension_start, |id| {
                        resource_conflict(
                            &mut self.connection_conflicts[id],
                            &self.network.connections[id].resources,
                            candidate.resources,
                        )
                    }) || self.stored.arena.any(
                        extension_start..extension_start + stored.extension_len,
                        |id| {
                            resource_conflict(
                                &mut self.extension_conflicts[id],
                                &self.network.problem.arcs[id].resources,
                                candidate.resources,
                            )
                        },
                    ) {
                        continue;
                    }
                }
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
        }
        if revenue > self.revenue {
            self.revenue = revenue;
            self.best_stored = partner;
            self.best_streamed = Some(self.network.route(
                0,
                candidate.reversed,
                candidate.connections.iter().copied(),
                candidate.extension.iter().copied(),
            ));
        }
        self.descended = true;
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
        for resource in resources {
            self.rows[resource][id / 64] |= 1 << (id % 64);
        }
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
        for group in groups.iter().filter(|group| group.words.end > base) {
            for (index, candidate) in group.candidates.iter().enumerate() {
                let word = group.words.start + index / 64;
                if word < base {
                    continue;
                }
                resource_candidates.insert(
                    (word - base) * 64 + index % 64,
                    group.candidates.resources(candidate, network),
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
            for resource in resources {
                for (bits, conflicts) in compatible
                    .iter_mut()
                    .zip(&resource_candidates.rows[resource][start - self.base..])
                {
                    *bits &= !conflicts;
                }
            }
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
    exhausted: bool,
    // The first descent picks each train's best compatible candidate and ends at the first leaf or
    // bound; it always finishes, so an interrupted selection still returns a legal operation.
    descended: bool,
}

impl<'a> Selection<'a> {
    fn new(
        candidates: &'a [Rc<Candidates>],
        network: Network<'a>,
        deadline: f64,
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
            deadline,
            exhausted: false,
            descended: false,
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
                    revenue += group.candidates[index].revenue;
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
            && (self.expansions == 1 || self.expansions.is_multiple_of(1024))
            && milliseconds() > self.deadline
        {
            self.exhausted = true;
        }
        self.exhausted
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
        for word in self.first_words[depth][group]..self.groups[group].words.end {
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
                if revenue + candidate.revenue * copies as i32 + remaining_upper + bonus_upper
                    <= self.revenue
                {
                    self.descended = true;
                    return;
                }
                self.current.push((train, index));
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
                            let bits =
                                parents[depth][next_word] & compatible[next_word - suffix_start];
                            children[0][next_word] = bits;
                            if bits != 0 && first == end {
                                first = next_word;
                            }
                        }
                        self.first_words[depth + 1][next_group] = first;
                    }
                }
                self.walk(depth + 1, next_revenue, next_longest);
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

pub fn solve(problem: &Problem) -> Result<Solution, String> {
    validate(problem)?;
    let started = milliseconds();
    let mut compiler = Compiler {
        problem,
        used: vec![false; problem.resource_count],
        junction_segments: vec![0; problem.junction_count],
        walking: vec![],
        connections: vec![],
        deadline: started + problem.budget_ms,
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
            compiler.walk(from, arc_id);
        }
    }
    let compiled_bytes = compiler.stored_bytes;
    let compiler_limited = compiler.limited;
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
    let compile_ms = milliseconds() - started;
    let network = Network {
        problem,
        connections: &connections,
        adjacency: &adjacency,
        departures: &departures,
    };
    let mut candidates: Vec<_> = problem
        .trains
        .iter()
        .map(|_| Rc::new(Candidates::new(network)))
        .collect();
    let mut counts = vec![0; problem.trains.len()];
    let mut expansions = 0;
    let mut path_exhaustive = !compiler.exhausted;
    let mut memory_limited = compiler_limited;
    // Whether some stage ran out of time, as opposed to memory.
    let mut timed_out = compiler.exhausted && !compiler_limited;
    let mut streamed_max = None;
    let previous_profile: Vec<Option<usize>> = (0..problem.trains.len())
        .map(|train_id| same_profile(problem, train_id))
        .collect();
    let mut profiles_left = previous_profile.iter().filter(|p| p.is_none()).count();
    let streaming = problem.trains.len() == 2 && profiles_left == 2;
    let mut train_order: Vec<_> = (0..problem.trains.len()).collect();
    if streaming {
        train_order.sort_by_key(|&id| {
            let train = &problem.trains[id];
            (train.distance, train.major_limit.unwrap_or(u32::MAX))
        });
    }
    let mut streamed_result = None;
    let fleet = problem.trains.len() > 1;
    let deadline = started + problem.budget_ms;
    let path_deadline = if fleet && !streaming {
        started + problem.budget_ms * 0.75
    } else {
        deadline
    };
    let row_budget = if streaming {
        0
    } else {
        problem.memory_budget_bytes / 4
    };
    let selection_bytes_per_candidate = if streaming {
        if problem.longest_route_bonus_per_stop == 0 {
            0
        } else {
            std::mem::size_of::<usize>()
        }
    } else {
        std::mem::size_of::<Option<Vec<u64>>>()
            + std::mem::size_of::<usize>()
            + problem.resource_count.div_ceil(8)
            + (problem.trains.len() + 1).div_ceil(8)
    };
    let mut candidate_budget = (problem.memory_budget_bytes - row_budget - compiled_bytes)
        .saturating_sub(if streaming {
            network.streaming_scratch_bytes()
        } else {
            0
        });
    for &train_id in &train_order {
        let train = &problem.trains[train_id];
        if let Some(previous) = previous_profile[train_id] {
            candidates[train_id] = Rc::clone(&candidates[previous]);
            counts[train_id] = counts[previous];
            continue;
        }
        let share = 1.0 / profiles_left as f64;
        let train_deadline = {
            let now = milliseconds();
            now + (path_deadline - now).max(0.0) * share
        };
        let train_memory = if streaming {
            candidate_budget
        } else {
            candidate_budget / profiles_left
        };
        profiles_left -= 1;
        let stored = (streaming && train_id == train_order[1])
            .then(|| Rc::clone(&candidates[train_order[0]]));
        let search = network.search(
            train,
            SearchPlan {
                deadline: train_deadline,
                memory_budget: train_memory,
                selection_bytes_per_candidate,
                best_only: !fleet,
                floor: None,
                streaming: stored.as_ref().map(|routes| {
                    StreamingSelection::new(
                        routes,
                        network,
                        deadline,
                        problem.memory_budget_bytes - compiled_bytes,
                    )
                }),
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
        timed_out |= search.exhausted;
        if let Some(selection) = search.streaming {
            streamed_max = Some(search.max_value);
            let mut routes = vec![];
            if let Some(id) = selection.best_stored {
                routes.push(selection.stored.route(id, train_order[0], network));
            }
            if let Some(mut route) = selection.best_streamed {
                route.train = train_id;
                routes.push(route);
            }
            routes.sort_unstable_by_key(|route| route.train);
            streamed_result = Some((selection.revenue, routes, !selection.exhausted));
        }
        candidates[train_id] = Rc::new(search.candidates);
    }
    let path_finished = milliseconds();
    let (mut revenue, mut routes, mut combination_exhaustive) =
        streamed_result.unwrap_or_else(|| {
            let mut selection = Selection::new(&candidates, network, deadline, row_budget);
            selection.walk(0, 0, 0);
            selection.best.sort_unstable_by_key(|&(train, _)| train);
            let routes = selection
                .best
                .iter()
                .map(|&(train, id)| candidates[train].route(id, train, network))
                .collect();
            (selection.revenue, routes, !selection.exhausted)
        });
    // A two-train fleet cut for memory is solved again, exactly, above what the first answer proves:
    // a better pair needs a route worth more than half its revenue when the trains are alike, or a
    // stored route worth more than the revenue less the other train's best route.
    timed_out |= !combination_exhaustive;
    let alike = problem.trains.len() == 2 && previous_profile[1] == Some(0);
    let threshold = match streamed_max {
        _ if !memory_limited || compiler_limited || timed_out => None,
        _ if alike => Some(revenue / 2),
        Some(best) if streaming => Some(revenue - best),
        _ => None,
    };
    if let Some(threshold) = threshold {
        let (stored_id, streamed_id) = if alike {
            (0, 1)
        } else {
            (train_order[0], train_order[1])
        };
        drop(candidates);
        let now = milliseconds();
        let stored = network.search(
            &problem.trains[stored_id],
            SearchPlan {
                deadline: now + (deadline - now).max(0.0) / 2.0,
                memory_budget: (problem.memory_budget_bytes - compiled_bytes)
                    .saturating_sub(network.streaming_scratch_bytes()),
                selection_bytes_per_candidate: if problem.longest_route_bonus_per_stop == 0 {
                    0
                } else {
                    std::mem::size_of::<usize>()
                },
                best_only: false,
                floor: Some(threshold),
                streaming: None,
            },
        );
        expansions += stored.expansions;
        if !stored.limited && !stored.exhausted {
            let mut selection = StreamingSelection::new(
                &stored.candidates,
                network,
                deadline,
                problem.memory_budget_bytes - compiled_bytes,
            );
            selection.seed(revenue);
            let streamed = network.search(
                &problem.trains[streamed_id],
                SearchPlan {
                    deadline,
                    memory_budget: 0,
                    selection_bytes_per_candidate: 0,
                    best_only: false,
                    floor: None,
                    streaming: Some(selection),
                },
            );
            expansions += streamed.expansions;
            if !streamed.exhausted
                && let Some(selection) = streamed.streaming
            {
                if selection.revenue > revenue {
                    revenue = selection.revenue;
                    routes = vec![];
                    if let Some(id) = selection.best_stored {
                        routes.push(selection.stored.route(id, stored_id, network));
                    }
                    if let Some(mut route) = selection.best_streamed {
                        route.train = streamed_id;
                        routes.push(route);
                    }
                    routes.sort_unstable_by_key(|route| route.train);
                }
                path_exhaustive = true;
                combination_exhaustive = true;
                memory_limited = false;
            }
        }
    }
    Ok(Solution {
        revenue,
        routes,
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
    })
}

// What every train's route search shares.
#[derive(Clone, Copy)]
struct Network<'a> {
    problem: &'a Problem,
    connections: &'a [Connection],
    adjacency: &'a [Vec<usize>],
    departures: &'a [Vec<usize>],
}

// How one train's routes are kept: stored within a memory budget, only above a value floor, or
// streamed through another train's stored routes.
struct SearchPlan<'a> {
    deadline: f64,
    memory_budget: usize,
    selection_bytes_per_candidate: usize,
    best_only: bool,
    floor: Option<i32>,
    streaming: Option<StreamingSelection<'a>>,
}

impl<'a> Network<'a> {
    fn streaming_scratch_bytes(&self) -> usize {
        self.connections.len()
            + if self
                .problem
                .trains
                .iter()
                .any(|train| !train.interconnections.is_empty())
            {
                self.problem.arcs.len()
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

    // Lists a train's routes, leaving stored candidates deduplicated and sorted by revenue.
    fn search<'b>(&self, train: &'b Train, plan: SearchPlan<'b>) -> Search<'b>
    where
        'a: 'b,
    {
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
                if problem.stops[edge.to].blocked && !problem.stops[edge.to].token {
                    continue;
                }
                let distance = token_distance[edge.to].saturating_add(
                    train.visit_costs[edge.to].saturating_add(if train.counts_crossings {
                        edge.crossings
                    } else {
                        0
                    }),
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
        let mut search = Search {
            problem,
            connections: self.connections,
            adjacency: self.adjacency,
            departures: self.departures,
            train,
            token_distance,
            origins: hex_flags(problem, train.interconnections.iter().flat_map(|i| &i.from)),
            destinations: hex_flags(problem, train.interconnections.iter().flat_map(|i| &i.to)),
            extension_parents: if train.interconnections.is_empty() {
                vec![]
            } else {
                vec![UNREACHED; problem.arcs.len()]
            },
            used: vec![0; problem.resource_count.div_ceil(64)],
            visited: vec![false; problem.stops.len()],
            groups: vec![false; problem.group_count],
            hexes: vec![0; problem.hex_bonuses.len()],
            walking: vec![],
            every_stop_costs: train.visit_costs.iter().all(|&cost| cost > 0),
            candidates: Candidates::new(*self),
            streaming: plan.streaming,
            count: 0,
            expansions: 0,
            best_only: plan.best_only,
            deadline: plan.deadline,
            exhausted: false,
            memory_budget: plan.memory_budget,
            selection_bytes_per_candidate: plan.selection_bytes_per_candidate,
            floor: plan.floor,
            limited: false,
            // A train may stay idle, so its best is never below nothing.
            max_value: 0,
        };
        for (id, stop) in problem.stops.iter().enumerate() {
            if stop.allowed && stop.endpoint {
                search.walk(
                    id,
                    id,
                    RouteValue {
                        cost: train.visit_costs[id],
                        majors: train.majors(stop),
                        revenue: 0,
                        token: false,
                        city: false,
                        first_bonus: 0,
                        last_bonus: 0,
                    },
                );
            }
            if search.exhausted {
                break;
            }
        }
        search.candidates.dedup(*self);
        search
            .candidates
            .entries
            .sort_unstable_by_key(|a| std::cmp::Reverse(a.revenue));
        search
            .candidates
            .shrink(plan.selection_bytes_per_candidate, plan.memory_budget);
        search
    }
}

// An earlier train whose candidates are the same as this one's.
fn same_profile(problem: &Problem, train_id: usize) -> Option<usize> {
    let train = &problem.trains[train_id];
    problem.trains[..train_id].iter().position(|other| {
        other.distance == train.distance
            && other.visit_costs == train.visit_costs
            && other.counts_crossings == train.counts_crossings
            && other.requires_city == train.requires_city
            && other.revenues == train.revenues
            && other.first_bonus == train.first_bonus
            && other.paying_stop_limit == train.paying_stop_limit
            && other.require_paying_token == train.require_paying_token
            && other.bonuses_along_route == train.bonuses_along_route
            && other.connection_bonuses == train.connection_bonuses
            && other.major_limit == train.major_limit
            && other.interconnections == train.interconnections
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
        .and_then(|p| solve(&p));
    match result {
        Ok(solution) => serde_json::to_vec(&solution).unwrap(),
        Err(error) => serde_json::to_vec(&serde_json::json!({"error": error})).unwrap(),
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm;

#[cfg(test)]
mod tests {
    use super::*;

    struct Tracks {
        problem: Problem,
        connections: Vec<Connection>,
    }

    impl Tracks {
        fn new() -> Self {
            Self {
                problem: serde_json::from_value(serde_json::json!({
                    "version": 6, "stops": [], "arcs": [], "trains": [],
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
                        crossings: 0,
                    })
                    .collect(),
            }
        }

        fn network(&self) -> Network<'_> {
            Network {
                problem: &self.problem,
                connections: &self.connections,
                adjacency: &[],
                departures: &[],
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
        let partial = stored.bytes(0) + network.streaming_scratch_bytes() + 20_000;
        for budget in [0, partial, usize::MAX] {
            let mut selection = StreamingSelection::new(&stored, network, -1.0, budget);
            if budget == partial {
                assert!(selection.resource_candidates.words > 0);
                assert!(selection.resource_candidates.words < stored.len() / 64);
            }
            selection.offer(CandidateView {
                revenue: 100,
                visits: 2,
                connections: &[0],
                resources: &[1, 0, 0],
                reversed: false,
                extension: &[],
            });
            assert!(!selection.exhausted);
            assert_eq!(selection.checks, 4096);
            assert_eq!(selection.revenue, 200);
            assert_eq!(selection.best_stored, Some(4095));
            selection.offer(CandidateView {
                revenue: 101,
                visits: 3,
                connections: &[0, 1],
                resources: &[3, 0, 0],
                reversed: false,
                extension: &[],
            });
            assert!(selection.exhausted);
            assert_eq!(selection.checks, 5120);
            assert_eq!(selection.revenue, 200);
            let partner = stored.route(selection.best_stored.unwrap(), 0, network);
            assert_eq!(partner.connections[0].paths, [1]);
            assert_eq!(selection.best_streamed.unwrap().connections[0].paths, [0]);
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
        for budget in [0, usize::MAX] {
            let mut selection = StreamingSelection::new(&stored, network, f64::INFINITY, budget);
            assert!(selection.wanted(1000, 2));
            selection.offer(CandidateView {
                revenue: 1000,
                visits: 2,
                connections: &[2],
                resources: &[4, 0, 0],
                reversed: false,
                extension: &[],
            });
            assert_eq!(selection.revenue, 2500);
            assert_eq!(selection.best_stored, Some(1));
            assert!(!selection.wanted(900, 2));
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
        let mut selection = Selection::new(&candidates, network, -1.0, usize::MAX);
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
