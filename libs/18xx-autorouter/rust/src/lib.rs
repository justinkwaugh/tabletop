use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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
}

#[derive(Deserialize)]
struct Stop {
    token: bool,
    blocked: bool,
    endpoint: bool,
    allowed: bool,
    city: bool,
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
    #[serde(default)]
    connection_bonuses: Vec<PaidConnectionBonus>,
}

#[derive(Deserialize, PartialEq)]
struct PaidConnectionBonus {
    from: Vec<Option<i32>>,
    to: Vec<Option<i32>>,
}

impl Train {
    fn paid_revenue(&self, visits: &[usize], stops: &[Stop]) -> i32 {
        let count = self
            .paying_stop_limit
            .unwrap_or(visits.len())
            .min(visits.len());
        if count == visits.len() {
            return self.selected_revenue(visits);
        }
        let mut best = 0;
        self.select_payments(visits, stops, 0, count, &mut Vec::new(), &mut best);
        best
    }

    fn select_payments(
        &self,
        visits: &[usize],
        stops: &[Stop],
        start: usize,
        count: usize,
        selected: &mut Vec<usize>,
        best: &mut i32,
    ) {
        if selected.len() == count {
            if !self.require_paying_token || selected.iter().any(|&id| stops[id].token) {
                *best = (*best).max(self.selected_revenue(selected));
            }
            return;
        }
        for index in start..=visits.len() - (count - selected.len()) {
            selected.push(visits[index]);
            self.select_payments(visits, stops, index + 1, count, selected, best);
            selected.pop();
        }
    }

    fn selected_revenue(&self, paid: &[usize]) -> i32 {
        let bonuses: i32 = self
            .connection_bonuses
            .iter()
            .map(|bonus| {
                let from = paid.iter().filter_map(|&id| bonus.from[id]).max();
                let to = paid.iter().filter_map(|&id| bonus.to[id]).max();
                match (from, to) {
                    (Some(from), Some(to)) => from + to,
                    _ => 0,
                }
            })
            .sum();
        paid.iter().map(|&id| self.revenues[id]).sum::<i32>() + bonuses
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
}

#[derive(Serialize)]
pub struct Solution {
    revenue: i32,
    routes: Vec<Route>,
    exhaustive: bool,
    path_exhaustive: bool,
    combination_exhaustive: bool,
    candidates: Vec<usize>,
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
    if problem.version != 4 || !problem.budget_ms.is_finite() || problem.budget_ms <= 0.0 {
        return Err("Unsupported problem version or budget".into());
    }
    for stop in &problem.stops {
        if stop.groups.iter().any(|&g| g >= problem.group_count) {
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
                    self.connections.push(Connection {
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
                    });
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
    train: &'a Train,
    token_distance: &'a [u32],
    used: Vec<u64>,
    visited: Vec<bool>,
    groups: Vec<bool>,
    hexes: Vec<u32>,
    walking: Vec<usize>,
    candidates: Vec<Candidate>,
    count: usize,
    expansions: u64,
    best_only: bool,
    deadline: f64,
    exhausted: bool,
}

impl Search<'_> {
    fn walk(&mut self, start: usize, node: usize, value: RouteValue) {
        let RouteValue {
            cost,
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
        if cost > self.train.distance {
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
            self.count += 1;
            let visits = self.walking.len() + 1;
            let payment_adjustment = if self.train.paying_stop_limit.is_some()
                || !self.train.connection_bonuses.is_empty()
            {
                let stops: Vec<_> = std::iter::once(start)
                    .chain(self.walking.iter().map(|&id| self.connections[id].to))
                    .collect();
                self.train.paid_revenue(&stops, &self.problem.stops)
                    - stops.iter().map(|&id| self.train.revenues[id]).sum::<i32>()
            } else {
                0
            };
            let total = revenue + payment_adjustment + first_bonus.max(last_bonus);
            let fleet_bonus = self.problem.longest_route_bonus_per_stop;
            if !self.best_only
                || self.candidates.first().is_none_or(|c| {
                    c.revenue + c.visits as i32 * fleet_bonus < total + visits as i32 * fleet_bonus
                })
            {
                if self.best_only {
                    self.candidates.clear();
                }
                self.candidates.push(Candidate {
                    revenue: total,
                    visits,
                    connections: self.walking.clone(),
                    resources: self.used.clone(),
                    reversed: last_bonus > first_bonus,
                });
            }
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
        for &connection_id in &self.adjacency[node] {
            let edge = &self.connections[connection_id];
            let next = &self.problem.stops[edge.to];
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
                    cost: cost
                        + self.train.visit_costs[edge.to]
                        + if self.train.counts_crossings {
                            edge.crossings
                        } else {
                            0
                        },
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
}

struct Selection<'a> {
    candidates: &'a [Rc<Vec<Candidate>>],
    upper: Vec<i32>,
    longest_upper: Vec<usize>,
    longest_bonus: i32,
    used: Vec<u64>,
    current: Vec<(usize, usize)>,
    best: Vec<(usize, usize)>,
    revenue: i32,
    expansions: u64,
    deadline: f64,
    exhausted: bool,
}

impl Selection<'_> {
    fn walk(&mut self, train: usize, revenue: i32, longest: usize) {
        self.expansions += 1;
        if self.exhausted
            || (self.expansions == 1 || self.expansions.is_multiple_of(4096))
                && milliseconds() > self.deadline
        {
            self.exhausted = true;
            return;
        }
        let total = revenue + longest as i32 * self.longest_bonus;
        if total > self.revenue {
            self.revenue = total;
            self.best.clone_from(&self.current);
        }
        let bonus_upper = longest.max(self.longest_upper[train]) as i32 * self.longest_bonus;
        if train == self.candidates.len()
            || revenue + self.upper[train] + bonus_upper <= self.revenue
        {
            return;
        }
        for (index, candidate) in self.candidates[train].iter().enumerate() {
            if revenue + candidate.revenue + self.upper[train + 1] + bonus_upper <= self.revenue {
                break;
            }
            if candidate
                .resources
                .iter()
                .zip(&self.used)
                .any(|(a, b)| a & b != 0)
            {
                continue;
            }
            for (used, bits) in self.used.iter_mut().zip(&candidate.resources) {
                *used |= bits;
            }
            self.current.push((train, index));
            self.walk(
                train + 1,
                revenue + candidate.revenue,
                longest.max(candidate.visits),
            );
            self.current.pop();
            for (used, bits) in self.used.iter_mut().zip(&candidate.resources) {
                *used &= !bits;
            }
            if self.exhausted {
                break;
            }
        }
        self.walk(train + 1, revenue, longest);
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
    };
    for (arc_id, arc) in problem.arcs.iter().enumerate() {
        if let Some(from) = arc.from
            && problem.stops[from].allowed
        {
            compiler.walk(from, arc_id);
        }
    }
    let connections = compiler.connections;
    let mut adjacency = vec![vec![]; problem.stops.len()];
    for (id, connection) in connections.iter().enumerate() {
        adjacency[connection.from].push(id);
    }
    let compile_ms = milliseconds() - started;
    let mut candidates: Vec<Rc<Vec<Candidate>>> = Vec::new();
    let mut counts = Vec::new();
    let mut expansions = 0;
    let mut path_exhaustive = !compiler.exhausted;
    for (train_id, train) in problem.trains.iter().enumerate() {
        if let Some(previous) = problem.trains[..train_id].iter().position(|other| {
            other.distance == train.distance
                && other.visit_costs == train.visit_costs
                && other.counts_crossings == train.counts_crossings
                && other.requires_city == train.requires_city
                && other.revenues == train.revenues
                && other.first_bonus == train.first_bonus
                && other.paying_stop_limit == train.paying_stop_limit
                && other.require_paying_token == train.require_paying_token
                && other.connection_bonuses == train.connection_bonuses
        }) {
            candidates.push(Rc::clone(&candidates[previous]));
            counts.push(counts[previous]);
            continue;
        }
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
            train,
            token_distance: &token_distance,
            used: vec![0; problem.resource_count.div_ceil(64)],
            visited: vec![false; problem.stops.len()],
            groups: vec![false; problem.group_count],
            hexes: vec![0; problem.hex_bonuses.len()],
            walking: vec![],
            candidates: vec![],
            count: 0,
            expansions: 0,
            best_only: problem.trains.len() == 1,
            deadline: started + problem.budget_ms,
            exhausted: false,
        };
        for (id, stop) in problem.stops.iter().enumerate() {
            if stop.allowed && stop.endpoint {
                search.walk(
                    id,
                    id,
                    RouteValue {
                        cost: train.visit_costs[id],
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
        search
            .candidates
            .sort_unstable_by_key(|a| std::cmp::Reverse(a.revenue));
        let mut seen = HashSet::new();
        search.candidates.retain(|c| {
            seen.insert((
                c.resources.clone(),
                if problem.longest_route_bonus_per_stop > 0 {
                    c.visits
                } else {
                    0
                },
            ))
        });
        counts.push(search.count);
        expansions += search.expansions;
        path_exhaustive &= !search.exhausted;
        candidates.push(Rc::new(search.candidates));
    }
    let path_finished = milliseconds();
    let mut upper = vec![0; candidates.len() + 1];
    let mut longest_upper = vec![0; candidates.len() + 1];
    for t in (0..candidates.len()).rev() {
        upper[t] = upper[t + 1] + candidates[t].first().map_or(0, |c| c.revenue);
        longest_upper[t] =
            longest_upper[t + 1].max(candidates[t].iter().map(|c| c.visits).max().unwrap_or(0));
    }
    let mut selection = Selection {
        candidates: &candidates,
        upper,
        longest_upper,
        longest_bonus: problem.longest_route_bonus_per_stop,
        used: vec![0; problem.resource_count.div_ceil(64)],
        current: vec![],
        best: vec![],
        revenue: 0,
        expansions: 0,
        deadline: path_finished + problem.budget_ms,
        exhausted: false,
    };
    selection.walk(0, 0, 0);
    let routes = selection
        .best
        .iter()
        .map(|&(train, id)| {
            let candidate = &candidates[train][id];
            let mut route_connections: Vec<_> = candidate
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
            if candidate.reversed {
                route_connections.reverse();
                for edge in &mut route_connections {
                    std::mem::swap(&mut edge.from, &mut edge.to);
                    edge.paths.reverse();
                }
            }
            Route {
                train,
                connections: route_connections,
            }
        })
        .collect();
    Ok(Solution {
        revenue: selection.revenue,
        routes,
        exhaustive: path_exhaustive && !selection.exhausted,
        path_exhaustive,
        combination_exhaustive: !selection.exhausted,
        candidates: counts,
        expansions,
        connections: connections.len(),
        compile_ms,
        path_ms: path_finished - started - compile_ms,
        combination_ms: milliseconds() - path_finished,
    })
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
