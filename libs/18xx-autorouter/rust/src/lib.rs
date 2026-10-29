use serde::{Deserialize, Serialize};
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

#[derive(Clone)]
struct Candidate {
    revenue: i32,
    visits: usize,
    connections: Vec<usize>,
    resources: Vec<u64>,
    reversed: bool,
    extension: Vec<usize>,
}

impl Candidate {
    fn value(&self, longest_bonus: i32) -> i32 {
        self.revenue + self.visits as i32 * longest_bonus
    }

    fn route(&self, train: usize, connections: &[Connection], problem: &Problem) -> Route {
        let mut route_connections: Vec<_> = self
            .connections
            .iter()
            .map(|&id| {
                let edge = &connections[id];
                RouteConnection {
                    from: edge.from,
                    to: edge.to,
                    paths: edge.paths.clone(),
                }
            })
            .collect();
        if self.reversed {
            route_connections.reverse();
            for edge in &mut route_connections {
                std::mem::swap(&mut edge.from, &mut edge.to);
                edge.paths.reverse();
            }
        }
        Route {
            train,
            connections: route_connections,
            extension: self
                .extension
                .iter()
                .map(|&arc| problem.arcs[arc].path)
                .collect(),
        }
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

impl CandidateView<'_> {
    fn to_owned(&self) -> Candidate {
        Candidate {
            revenue: self.revenue,
            visits: self.visits,
            connections: self.connections.to_vec(),
            resources: self.resources.to_vec(),
            reversed: self.reversed,
            extension: self.extension.to_vec(),
        }
    }
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
    token_distance: &'a [u32],
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
    candidates: Vec<Candidate>,
    streaming: Option<StreamingSelection<'a>>,
    count: usize,
    expansions: u64,
    best_only: bool,
    deadline: f64,
    exhausted: bool,
    // Bytes the stored candidates may take, counting their share of the selection's tables.
    memory_budget: usize,
    stored_bytes: usize,
    selection_bytes_per_candidate: usize,
    // Once the budget is reached, only candidates worth more than the weakest one kept are stored.
    floor: Option<i32>,
    limited: bool,
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
    fn wanted(&self, revenue: i32, visits: usize) -> bool {
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
            let candidate = candidate.to_owned();
            self.offer_stored(candidate);
        }
        for &r in extension
            .iter()
            .flat_map(|&arc| &self.problem.arcs[arc].resources)
        {
            self.used[r / 64] &= !(1 << (r % 64));
        }
    }

    fn offer_stored(&mut self, candidate: Candidate) {
        let fleet_bonus = self.problem.longest_route_bonus_per_stop;
        let value = |c: &Candidate| c.value(fleet_bonus);
        if !self.best_only {
            if self.floor.is_some_and(|floor| value(&candidate) <= floor) {
                return;
            }
            // Growing the candidate vector briefly holds the old and the new allocation.
            let header = std::mem::size_of::<Candidate>();
            if self.candidates.len() == self.candidates.capacity()
                && self.stored_bytes + 3 * self.candidates.capacity().max(4) * header
                    > self.memory_budget
            {
                self.reclaim();
                if self.floor.is_some_and(|floor| value(&candidate) <= floor) {
                    return;
                }
            }
            self.stored_bytes +=
                candidate_bytes(&candidate, self.selection_bytes_per_candidate) - header;
            self.candidates.push(candidate);
            if self.stored_bytes + self.candidates.capacity() * header > self.memory_budget {
                self.reclaim();
            }
        } else if self
            .candidates
            .first()
            .is_none_or(|best| value(best) < value(&candidate))
        {
            self.candidates.clear();
            self.candidates.push(candidate);
        }
    }

    // Frees room for more candidates: duplicates go first, which loses nothing; if that is not
    // enough, only the more valuable half is kept.
    fn reclaim(&mut self) {
        let header = std::mem::size_of::<Candidate>();
        let payload = |candidates: &[Candidate]| -> usize {
            candidates
                .iter()
                .map(|c| candidate_bytes(c, self.selection_bytes_per_candidate) - header)
                .sum()
        };
        dedup_candidates(self.problem, &mut self.candidates);
        self.stored_bytes = payload(&self.candidates);
        if self.stored_bytes + self.candidates.len() * header > self.memory_budget / 2 {
            let fleet_bonus = self.problem.longest_route_bonus_per_stop;
            let value = |c: &Candidate| c.value(fleet_bonus);
            self.candidates
                .sort_unstable_by_key(|c| std::cmp::Reverse(value(c)));
            self.candidates.truncate(self.candidates.len() / 2);
            self.floor = self.candidates.last().map(value);
            self.stored_bytes = payload(&self.candidates);
            self.limited = true;
        }
        self.candidates.shrink_to_fit();
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

// Of candidates using the same track, only the most valuable can be best. Sorting groups them in
// place, without copying every resource set into a lookup.
fn dedup_candidates(problem: &Problem, candidates: &mut Vec<Candidate>) {
    let visits = |c: &Candidate| {
        if problem.longest_route_bonus_per_stop > 0 {
            c.visits
        } else {
            0
        }
    };
    candidates.sort_unstable_by(|a, b| {
        (&a.resources, visits(a))
            .cmp(&(&b.resources, visits(b)))
            .then(b.revenue.cmp(&a.revenue))
    });
    candidates
        .dedup_by(|later, kept| later.resources == kept.resources && visits(later) == visits(kept));
}

// What one compiled connection costs: itself, its lists with allocator overhead, and its entry in
// the stop adjacency built from them.
fn connection_bytes(connection: &Connection) -> usize {
    const ALLOCATION: usize = 16;
    std::mem::size_of::<Connection>()
        + (connection.paths.len() + connection.resources.len() + connection.hexes.len())
            * std::mem::size_of::<usize>()
        + 3 * ALLOCATION
        + std::mem::size_of::<usize>()
}

// Reserve selection storage during enumeration, before its tables are allocated.
fn candidate_bytes(candidate: &Candidate, selection_bytes: usize) -> usize {
    const ALLOCATION: usize = 16;
    std::mem::size_of::<Candidate>()
        + candidate.connections.len() * std::mem::size_of::<usize>()
        + candidate.resources.len() * std::mem::size_of::<u64>()
        + candidate.extension.len() * std::mem::size_of::<usize>()
        + 3 * ALLOCATION
        + selection_bytes
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
    candidates: &'a [Candidate],
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
    stored: &'a [Candidate],
    longest_suffix: Vec<usize>,
    longest_bonus: i32,
    revenue: i32,
    best_stored: Option<usize>,
    best_streamed: Option<Candidate>,
    deadline: f64,
    checks: u64,
    descended: bool,
    exhausted: bool,
}

impl<'a> StreamingSelection<'a> {
    fn new(stored: &'a [Candidate], longest_bonus: i32, deadline: f64) -> Self {
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
            longest_suffix: longest_suffix(stored, longest_bonus),
            longest_bonus,
            revenue,
            best_stored,
            best_streamed: None,
            deadline,
            checks: 0,
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

    fn offer(&mut self, candidate: CandidateView<'_>) {
        let mut revenue = candidate.revenue + candidate.visits as i32 * self.longest_bonus;
        let mut partner = None;
        for (id, stored) in self.stored.iter().enumerate() {
            if self.upper(candidate.revenue, candidate.visits, id) <= self.revenue.max(revenue) {
                break;
            }
            self.checks += 1;
            if self.descended && self.checks.is_multiple_of(1024) && milliseconds() > self.deadline
            {
                self.exhausted = true;
                break;
            }
            if stored
                .resources
                .iter()
                .zip(candidate.resources)
                .any(|(a, b)| a & b != 0)
            {
                continue;
            }
            let total = candidate.revenue
                + stored.revenue
                + candidate.visits.max(stored.visits) as i32 * self.longest_bonus;
            if total > revenue {
                revenue = total;
                partner = Some(id);
            }
            if self.longest_bonus == 0 {
                break;
            }
        }
        if revenue > self.revenue {
            self.revenue = revenue;
            self.best_stored = partner;
            self.best_streamed = Some(candidate.to_owned());
        }
        self.descended = true;
    }
}

// Which candidates each candidate can run beside. Selection only asks about candidates after the
// one chosen, so columns before the first group's suffix are never kept.
struct Compatibility {
    // Candidates using each resource, over the words from `base`.
    resource_candidates: Vec<Vec<u64>>,
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
        resource_count: usize,
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
                resource_candidates: vec![],
                base: words,
                words,
                rows: vec![],
                scratch: vec![],
                row_budget,
                row_bytes: 0,
            };
        }
        let mut resource_candidates = vec![vec![0; words - base]; resource_count];
        for group in groups.iter().filter(|group| group.words.end > base) {
            for (index, candidate) in group.candidates.iter().enumerate() {
                let word = group.words.start + index / 64;
                if word < base {
                    continue;
                }
                for (resource_word, &resources) in candidate.resources.iter().enumerate() {
                    let mut resources = resources;
                    while resources != 0 {
                        let resource = resource_word * 64 + resources.trailing_zeros() as usize;
                        resources &= resources - 1;
                        resource_candidates[resource][word - base] |= 1 << (index % 64);
                    }
                }
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

    fn row(&mut self, id: usize, candidate: &Candidate, start: usize) -> &[u64] {
        let fill = |compatible: &mut Vec<u64>, resource_candidates: &[Vec<u64>]| {
            compatible.clear();
            compatible.resize(self.words - start, u64::MAX);
            for (word, &resources) in candidate.resources.iter().enumerate() {
                let mut resources = resources;
                while resources != 0 {
                    let resource = word * 64 + resources.trailing_zeros() as usize;
                    resources &= resources - 1;
                    for (bits, conflicts) in compatible
                        .iter_mut()
                        .zip(&resource_candidates[resource][start - self.base..])
                    {
                        *bits &= !conflicts;
                    }
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
        candidates: &'a [Rc<Vec<Candidate>>],
        resource_count: usize,
        longest_bonus: i32,
        deadline: f64,
        row_budget: usize,
    ) -> Self {
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
        let compatibility = Compatibility::new(&groups, resource_count, initial.len(), row_budget);
        let mut available = vec![vec![0; initial.len()]; order.len() + 1];
        available[0] = initial;
        let first_words =
            vec![groups.iter().map(|group| group.words.start).collect(); order.len() + 1];
        Self {
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
                    let compatible =
                        self.compatibility
                            .row(word * 64 + bit, candidate, suffix_start);
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
    let mut candidates: Vec<_> = problem.trains.iter().map(|_| Rc::new(vec![])).collect();
    let mut counts = vec![0; problem.trains.len()];
    let mut expansions = 0;
    let mut path_exhaustive = !compiler.exhausted;
    let mut memory_limited = compiler_limited;
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
    let mut candidate_budget = problem.memory_budget_bytes - row_budget - compiled_bytes;
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
        let mut token_distance = vec![u32::MAX; problem.stops.len()];
        for (id, stop) in problem.stops.iter().enumerate() {
            if stop.token {
                token_distance[id] = 0;
            }
        }
        for _ in 0..problem.stops.len() {
            let mut changed = false;
            for edge in &connections {
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
            connections: &connections,
            adjacency: &adjacency,
            departures: &departures,
            train,
            token_distance: &token_distance,
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
            candidates: vec![],
            streaming: stored.as_ref().map(|routes| {
                StreamingSelection::new(routes, problem.longest_route_bonus_per_stop, deadline)
            }),
            count: 0,
            expansions: 0,
            best_only: !fleet,
            deadline: train_deadline,
            exhausted: false,
            memory_budget: train_memory,
            stored_bytes: 0,
            selection_bytes_per_candidate,
            floor: None,
            limited: false,
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
        dedup_candidates(problem, &mut search.candidates);
        search
            .candidates
            .sort_unstable_by_key(|a| std::cmp::Reverse(a.revenue));
        search.candidates.shrink_to_fit();
        candidate_budget -= search
            .candidates
            .iter()
            .map(|c| candidate_bytes(c, selection_bytes_per_candidate))
            .sum::<usize>()
            .min(candidate_budget);
        counts[train_id] = search.count;
        expansions += search.expansions;
        path_exhaustive &= !search.exhausted && !search.limited;
        memory_limited |= search.limited;
        if let Some(selection) = search.streaming {
            let mut routes = vec![];
            if let Some(id) = selection.best_stored {
                routes.push(selection.stored[id].route(train_order[0], &connections, problem));
            }
            if let Some(candidate) = &selection.best_streamed {
                routes.push(candidate.route(train_id, &connections, problem));
            }
            routes.sort_unstable_by_key(|route| route.train);
            streamed_result = Some((selection.revenue, routes, !selection.exhausted));
        }
        candidates[train_id] = Rc::new(search.candidates);
    }
    let path_finished = milliseconds();
    let (revenue, routes, combination_exhaustive) = streamed_result.unwrap_or_else(|| {
        let mut selection = Selection::new(
            &candidates,
            problem.resource_count,
            problem.longest_route_bonus_per_stop,
            deadline,
            row_budget,
        );
        selection.walk(0, 0, 0);
        selection.best.sort_unstable_by_key(|&(train, _)| train);
        let routes = selection
            .best
            .iter()
            .map(|&(train, id)| candidates[train][id].route(train, &connections, problem))
            .collect();
        (selection.revenue, routes, !selection.exhausted)
    });
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

    #[test]
    fn interrupted_streaming_finishes_its_first_partner_search_and_keeps_the_pair() {
        let stored: Vec<_> = (0..4096)
            .map(|index| Candidate {
                revenue: 100,
                visits: 2,
                connections: vec![],
                resources: vec![if index == 4095 { 2 } else { 1 }],
                reversed: false,
                extension: vec![],
            })
            .collect();
        let mut selection = StreamingSelection::new(&stored, 0, -1.0);
        selection.offer(CandidateView {
            revenue: 100,
            visits: 2,
            connections: &[],
            resources: &[1],
            reversed: false,
            extension: &[],
        });
        assert!(!selection.exhausted);
        assert_eq!(selection.checks, 4096);
        assert_eq!(selection.revenue, 200);
        assert_eq!(selection.best_stored, Some(4095));
        selection.offer(CandidateView {
            revenue: 101,
            visits: 2,
            connections: &[],
            resources: &[3],
            reversed: false,
            extension: &[],
        });
        assert!(selection.exhausted);
        assert_eq!(selection.checks, 5120);
        assert_eq!(selection.revenue, 200);
        let partner = &stored[selection.best_stored.unwrap()];
        assert_eq!(
            partner.resources[0] & selection.best_streamed.unwrap().resources[0],
            0
        );
    }

    #[test]
    fn streaming_continues_past_a_compatible_partner_for_a_larger_longest_bonus() {
        let stored = [
            Candidate {
                revenue: 100,
                visits: 2,
                connections: vec![],
                resources: vec![1],
                reversed: false,
                extension: vec![],
            },
            Candidate {
                revenue: 0,
                visits: 5,
                connections: vec![],
                resources: vec![2],
                reversed: false,
                extension: vec![],
            },
        ];
        let mut selection = StreamingSelection::new(&stored, 300, f64::INFINITY);
        assert!(selection.wanted(1000, 2));
        selection.offer(CandidateView {
            revenue: 1000,
            visits: 2,
            connections: &[],
            resources: &[4],
            reversed: false,
            extension: &[],
        });
        assert_eq!(selection.revenue, 2500);
        assert_eq!(selection.best_stored, Some(1));
        assert!(!selection.wanted(900, 2));
    }

    #[test]
    fn interrupted_selection_stops_after_a_first_descent_that_ends_at_a_bound() {
        // Two identical trains whose candidates all share one piece of track: after the first
        // pick nothing else fits, so the first descent ends at a bound, not at a full fleet.
        let routes: Vec<_> = (0..4096)
            .map(|index| Candidate {
                revenue: 10_000 - index,
                visits: 2,
                connections: vec![],
                resources: vec![1],
                reversed: false,
                extension: vec![],
            })
            .collect();
        let shared = Rc::new(routes);
        let candidates = [Rc::clone(&shared), shared];
        let mut selection = Selection::new(&candidates, 1, 0, -1.0, usize::MAX);
        selection.walk(0, 0, 0);
        assert!(selection.exhausted);
        assert_eq!(selection.revenue, 10_000);
        assert!(
            selection.expansions < 2048,
            "{} expansions",
            selection.expansions
        );
    }
}
