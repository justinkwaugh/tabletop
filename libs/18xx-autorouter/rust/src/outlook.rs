use super::{Connection, Problem, RouteValue, Search, Train};

/// What the rest of a route could still earn a train whatever track it finds: its stops by what
/// they pay, how much of the train's distance lies between them, and the bonuses in reach. The
/// search drops a route no continuation of which it would keep.
pub(super) struct Outlook {
    // Stops worth something, the best first: those every way in uses some distance, and the rest.
    costly: Vec<usize>,
    free: Vec<usize>,
    // What each stop pays, with its shares of connection bonuses unless a paying limit chooses
    // among the stops, when the shares are counted apart.
    worth: Vec<i32>,
    shares: Vec<(usize, i32)>,
    // The least distance a route uses from one stop to another.
    reach: Vec<u32>,
    stops: usize,
    // The least distance any stop that uses some uses.
    step: u32,
    // What a first-stop bonus and an interconnection add at most.
    extras: i32,
    bonuses: Vec<Bonus>,
}

/// A connection bonus: the most it pays, and the stops a route needs one of from each list.
/// Where some lists name a single stop, the route needs every such stop, so the bonus is at most
/// an even share of it for each of them the route has.
struct Bonus {
    amount: i32,
    needs: Vec<Vec<usize>>,
    singles: Vec<usize>,
    share: i32,
}

impl Outlook {
    /// None where the game chooses which stops a train calls at, which a route's stops alone do
    /// not bound, and for a fleet, whose selection weighs more than each route's revenue.
    pub(super) fn new(
        problem: &Problem,
        connections: &[Connection],
        train: &Train,
    ) -> Option<Self> {
        if problem.fleet.is_some() || train.calls_selectively() || train.subsidizes() {
            return None;
        }
        let stops = problem.stops.len();
        let mut reach = vec![u32::MAX; stops * stops];
        let mut least = vec![u32::MAX; stops];
        for edge in connections {
            if train.allowed_stops.get(edge.to) == Some(&false) {
                continue;
            }
            let cost = train.visit_costs[edge.to].saturating_add(train.crossing_cost(edge));
            let at = edge.from * stops + edge.to;
            reach[at] = reach[at].min(cost);
            least[edge.to] = least[edge.to].min(cost);
        }
        for id in 0..stops {
            reach[id * stops + id] = 0;
        }
        for via in 0..stops {
            for from in 0..stops {
                let first = reach[from * stops + via];
                if first == u32::MAX {
                    continue;
                }
                for to in 0..stops {
                    let through = first.saturating_add(reach[via * stops + to]);
                    if through < reach[from * stops + to] {
                        reach[from * stops + to] = through;
                    }
                }
            }
        }
        let step = least
            .iter()
            .copied()
            .filter(|&cost| cost > 0 && cost != u32::MAX)
            .min()
            .unwrap_or(1);
        let bonuses: Vec<Bonus> = train
            .connection_bonuses
            .iter()
            .filter_map(|bonus| {
                let best = |amounts: &[Option<i32>]| amounts.iter().flatten().copied().max();
                let amount = best(&bonus.from)? + best(&bonus.to)?;
                let paying = |amounts: &[Option<i32>]| -> Vec<usize> {
                    (0..stops).filter(|&id| amounts[id].is_some()).collect()
                };
                let mut needs = vec![paying(&bonus.from), paying(&bonus.to)];
                needs.extend(
                    bonus
                        .requires
                        .iter()
                        .map(|mask| (0..stops).filter(|&id| mask[id]).collect()),
                );
                let mut singles: Vec<usize> = needs
                    .iter()
                    .filter(|stops| stops.len() == 1)
                    .map(|stops| stops[0])
                    .collect();
                singles.sort_unstable();
                singles.dedup();
                let share = if singles.is_empty() {
                    0
                } else {
                    (amount + singles.len() as i32 - 1) / singles.len() as i32
                };
                (amount > 0).then_some(Bonus {
                    amount,
                    needs,
                    singles,
                    share,
                })
            })
            .collect();
        let mut share = vec![0; stops];
        for bonus in &bonuses {
            for &id in &bonus.singles {
                share[id] += bonus.share;
            }
        }
        let limited = train.paying_stop_limit.is_some();
        let worth: Vec<i32> = (0..stops)
            .map(|id| train.revenues[id] + if limited { 0 } else { share[id] })
            .collect();
        let mut paying: Vec<usize> = (0..stops)
            .filter(|&id| worth[id] > 0 && least[id] != u32::MAX)
            .collect();
        paying.sort_by_key(|&id| std::cmp::Reverse(worth[id]));
        let (costly, free) = paying.into_iter().partition(|&id| least[id] > 0);
        let interconnection = train
            .interconnections
            .iter()
            .map(|interconnection| interconnection.amount)
            .max()
            .unwrap_or(0);
        let first_bonus = train.first_bonus.iter().copied().max().unwrap_or(0);
        Some(Self {
            costly,
            free,
            worth,
            shares: if limited {
                (0..stops)
                    .filter(|&id| share[id] > 0)
                    .map(|id| (id, share[id]))
                    .collect()
            } else {
                vec![]
            },
            reach,
            stops,
            step,
            extras: interconnection + first_bonus,
            bonuses,
        })
    }
}

impl Search<'_> {
    /// Whether some route that runs on from the stop could be kept, by the most its further
    /// stops, hexes and bonuses could add. The bound relaxes the track and the order of stops: a
    /// further stop is any the train's remaining distance reaches, no more of them than the
    /// distance, the blocked ends and the major stops left allow.
    pub(super) fn continues(&mut self, start: usize, node: usize, value: RouteValue) -> bool {
        let Some(outlook) = &self.profile.outlook else {
            return true;
        };
        // The bound is not worth its sums where it drops few routes: a listing above a low floor
        // keeps most of them, and so does a train whose distance reaches every stop. It is tried
        // at the start of each stretch of the search and left out for the rest of the stretch
        // when it dropped few routes; fewer count as few for the one best route, which each
        // drop shortens more.
        let stretch = self.expansions / BOUND_STRETCH;
        if stretch != self.stretch {
            self.stretch = stretch;
            self.cuts = 0;
        }
        let few = BOUND_TRIAL / if self.best_only { 64 } else { 8 };
        if self.expansions % BOUND_STRETCH >= BOUND_TRIAL && self.cuts < few {
            return true;
        }
        let (problem, train) = (self.problem, self.train);
        let remaining = train.distance - value.cost;
        let slots = (remaining / outlook.step) as usize;
        // A blocked stop ends the route; one run through on the train's own allowance pays
        // nothing, and one run through on the run's allowance pays.
        let passes_left =
            (problem.blocked_passes + train.blocked_passes).saturating_sub(value.passes) as usize;
        let blocked_ends = 1 + if train.blocked_passes > 0 {
            0
        } else {
            passes_left
        };
        let majors_left = train
            .major_limit
            .map(|limit| limit.saturating_sub(value.majors) as usize);
        let reach = &outlook.reach[node * outlook.stops..(node + 1) * outlook.stops];
        let (visited, groups) = (&self.visited, &self.groups);
        let open = |id: usize| {
            !visited[id]
                && reach[id] <= remaining
                && !problem.stops[id].groups.iter().any(|&g| groups[g])
        };
        // The paying limit chooses among the stops that count, those of the route so far too.
        let limit = train.paying_stop_limit;
        let counted = &mut self.amounts;
        counted.clear();
        // The best stops within the distance and the blocked ends left, or within the distance
        // and the major stops left: the two limits overlap, so each alone bounds both together.
        // Under a paying limit the stops outside it are chosen apart from those it chooses
        // among, each kind as if the distance were all its own.
        let best = |by_majors: bool, counted: Option<&mut Vec<i32>>| {
            let mut sum = 0;
            let mut left = [slots; 2];
            let mut ends_left = [blocked_ends; 2];
            let mut majors = majors_left.unwrap_or(usize::MAX);
            let mut counted = counted;
            for &id in &outlook.costly {
                if left == [0; 2] {
                    break;
                }
                if !open(id) {
                    continue;
                }
                let apart = usize::from(counted.is_some() && train.uncounted(id));
                if left[apart] == 0 {
                    continue;
                }
                let stop = &problem.stops[id];
                if by_majors {
                    if !stop.town {
                        if majors == 0 {
                            continue;
                        }
                        majors -= 1;
                    }
                } else if stop.blocked {
                    if ends_left[apart] == 0 {
                        continue;
                    }
                    ends_left[apart] -= 1;
                }
                left[apart] -= 1;
                match counted.as_deref_mut() {
                    Some(amounts) if apart == 0 => amounts.push(outlook.worth[id]),
                    _ => sum += outlook.worth[id],
                }
            }
            sum
        };
        let mut further = best(false, limit.map(|_| &mut *counted));
        if majors_left.is_some() && limit.is_none() {
            further = further.min(best(true, None));
        }
        let mut ends_left = blocked_ends;
        for &id in &outlook.free {
            if !open(id) {
                continue;
            }
            if problem.stops[id].blocked {
                if ends_left == 0 {
                    continue;
                }
                ends_left -= 1;
            }
            if limit.is_some() && !train.uncounted(id) {
                counted.push(outlook.worth[id]);
            } else {
                further += outlook.worth[id];
            }
        }
        further += outlook
            .shares
            .iter()
            .filter(|&&(id, _)| open(id))
            .map(|&(_, share)| share)
            .sum::<i32>();
        let paid = if let Some(limit) = limit {
            let mut uncounted = 0;
            let route = std::iter::once(start)
                .chain(self.walking.iter().map(|&id| self.connections[id].to));
            for (index, id) in route.enumerate() {
                if index > 0 && train.blocked_passes > 0 && problem.stops[id].blocked {
                    continue;
                }
                if train.uncounted(id) {
                    uncounted += train.revenues[id];
                } else {
                    counted.push(train.revenues[id]);
                }
            }
            counted.sort_unstable_by_key(|&amount| std::cmp::Reverse(amount));
            uncounted + counted.iter().take(limit).sum::<i32>()
        } else {
            value.revenue - value.collected - value.unpaid
        };
        let bonuses: i32 = outlook
            .bonuses
            .iter()
            .filter(|bonus| {
                bonus
                    .needs
                    .iter()
                    .all(|stops| stops.iter().any(|&id| visited[id] || open(id)))
            })
            .map(|bonus| {
                if bonus.singles.is_empty() {
                    bonus.amount
                } else {
                    bonus.share * bonus.singles.iter().filter(|&&id| visited[id]).count() as i32
                }
            })
            .sum();
        let revenue = paid + further + value.collected + self.bonus_left + bonuses + outlook.extras;
        // Every stop not yet visited, where the longest route earns more.
        let visits = if problem.longest_route_bonus_per_stop == 0 {
            0
        } else {
            self.walking.len() + 1 + visited.iter().filter(|&&visited| !visited).count()
        };
        let wanted = self.would_want(revenue, visits);
        self.cuts += u64::from(!wanted);
        wanted
    }
}

const BOUND_STRETCH: u64 = 1 << 16;
const BOUND_TRIAL: u64 = 1 << 12;
