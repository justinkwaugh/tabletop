//! Generated networks hold the searches that prune to a listing of every route: a train's one
//! best route, found with a bound on what the rest of a route can earn and without connections
//! that differ from one already walked only in track nothing needed, and two trains' best pair,
//! found from each one's best route and by keeping them apart.

use super::*;
use serde_json::{Value, json};

struct Random(u64);

impl Random {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }

    fn below(&mut self, limit: usize) -> usize {
        (self.next() % limit as u64) as usize
    }

    fn one_in(&mut self, chances: usize) -> bool {
        self.below(chances) == 0
    }

    fn pick<T: Copy>(&mut self, items: &[T]) -> T {
        items[self.below(items.len())]
    }
}

const EXITS: usize = 3;
const MIDDLES: usize = 6;

/// A network of stops with a few ways out each, joined by links that leave one stop by one of its
/// ways out, run over up to two shared pieces of plain track, each in a hex of its own, and
/// enter the other stop by one of its ways in. Links between the same stops differ in track and
/// in the hexes they run through.
fn network(random: &mut Random, stops: usize, links: usize) -> Value {
    let hexes = stops + MIDDLES;
    let exit = |stop: usize, way: usize| stop * EXITS + way;
    let middle = |piece: usize| stops * EXITS + piece;
    let mut arcs: Vec<Value> = vec![];
    for _ in 0..links {
        let from = random.below(stops);
        let to = (from + 1 + random.below(stops - 1)) % stops;
        let mut pieces = vec![(exit(from, random.below(EXITS)), from)];
        for _ in 0..random.below(3) {
            let piece = random.below(MIDDLES);
            pieces.push((middle(piece), stops + piece));
        }
        pieces.push((exit(to, random.below(EXITS)), to));
        let first = arcs.len();
        let last = first + 2 * (pieces.len() - 1);
        let terminus = random.one_in(12);
        let crossings = random.below(2);
        for (index, &(resource, hex)) in pieces.iter().enumerate() {
            let forward = first + 2 * index;
            let arc = |from: Value, to: Value, next: Vec<usize>, terminal: bool, departs: bool| {
                json!({
                    "from": from, "to": to, "next": next, "resources": [resource],
                    "junctions": [], "path": forward / 2, "hex": hex, "crossings": crossings,
                    "terminal": terminal, "departs_terminal": departs,
                })
            };
            let begins = (index == 0).then_some(from);
            let ends = (forward == last).then_some(to);
            arcs.push(arc(
                json!(begins),
                json!(ends),
                if forward == last {
                    vec![]
                } else {
                    vec![forward + 2]
                },
                terminus && forward == last,
                false,
            ));
            arcs.push(arc(
                json!(ends),
                json!(begins),
                if index == 0 {
                    vec![]
                } else {
                    vec![forward - 1]
                },
                false,
                terminus && forward == last,
            ));
        }
    }
    let bonuses: Vec<i64> = (0..hexes)
        .map(|_| random.pick(&[0, 0, 0, 10, 20, 20, -10]))
        .collect();
    json!({
        "version": 11, "junction_count": 1, "budget_ms": 30000, "memory_budget_bytes": 48_000_000,
        "resource_count": stops * EXITS + MIDDLES, "group_count": 2,
        "no_reentry_hexes": (0..hexes)
            .map(|hex| if random.one_in(4) { random.one_in(2) } else { bonuses[hex] > 0 })
            .collect::<Vec<_>>(),
        "hex_bonuses": bonuses,
        "minimum_cities_and_towns": if random.one_in(6) { 2 } else { 0 },
        "longest_route_bonus_per_stop": if random.one_in(8) { 10 } else { 0 },
        "stops": (0..stops).map(|id| json!({
            "token": id == 0 || random.one_in(5), "blocked": random.one_in(4),
            "endpoint": !random.one_in(6), "allowed": !random.one_in(12),
            "city": !random.one_in(4), "town": false, "hex": id,
            "groups": if random.one_in(5) { vec![random.below(2)] } else { vec![] },
        })).collect::<Vec<_>>(),
        "arcs": arcs,
        "trains": [],
    })
}

fn train(random: &mut Random, id: &str, stops: usize) -> Value {
    let amounts = |random: &mut Random| -> Vec<Option<i64>> {
        (0..stops)
            .map(|_| random.one_in(3).then(|| 10 * random.below(4) as i64))
            .collect()
    };
    let distance = 2 + random.below(5);
    let counts_crossings = random.one_in(8);
    let limit = random.one_in(3).then(|| 1 + random.below(distance));
    let mut train = json!({
        "id": id, "distance": distance + if counts_crossings { 2 } else { 0 },
        "crossing_costs": if counts_crossings { [1, 1, 1] } else { [0, 0, 0] },
        "requires_city": random.one_in(6),
        "visit_costs": (0..stops)
            .map(|_| if random.one_in(5) { 0 } else { 1 })
            .collect::<Vec<_>>(),
        "revenues": (0..stops).map(|_| 10 * random.below(10)).collect::<Vec<_>>(),
        "first_bonus": (0..stops)
            .map(|_| if random.one_in(10) { 10 } else { 0 })
            .collect::<Vec<_>>(),
        "paying_stop_limit": limit,
        "require_paying_token": limit.is_some() && random.one_in(3),
        "blocked_passes": random.below(2),
        "bonuses_along_route": random.one_in(6),
    });
    if limit.is_some() && random.one_in(2) {
        train["uncounted"] = json!((0..stops).map(|_| random.one_in(4)).collect::<Vec<_>>());
    }
    if random.one_in(3) {
        train["connection_bonuses"] = (0..1 + random.below(2))
            .map(|_| {
                let mut bonus = json!({
                    "from": amounts(random), "to": amounts(random), "ends_only": random.one_in(4),
                });
                if random.one_in(2) {
                    let needed = random.below(stops);
                    bonus["requires"] =
                        json!([(0..stops).map(|id| id == needed).collect::<Vec<_>>()]);
                }
                bonus
            })
            .collect();
    }
    if random.one_in(5) {
        train["major_limit"] = json!(1 + random.below(distance));
    }
    if random.one_in(8) {
        train["allowed_stops"] = json!((0..stops).map(|_| !random.one_in(6)).collect::<Vec<_>>());
    }
    if random.one_in(10) {
        train["optional"] = json!((0..stops).map(|_| random.one_in(3)).collect::<Vec<_>>());
        // The game chooses the stops such a train calls at by what they pay alone.
        train["connection_bonuses"] = json!([]);
        train["paying_stop_limit"] = Value::Null;
        train["require_paying_token"] = json!(false);
    }
    train
}

/// PRUNING_CASES=n runs n generated cases of each kind in place of the few of the default suite,
/// PRUNING_SEED=n a different series of them, and PRUNING_STOPS=n networks of up to n stops.
fn setting(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn generated(random: &mut Random, trains: usize) -> Value {
    let stops = 4 + random.below(setting("PRUNING_STOPS", 7) - 3);
    let links = stops + 2 + random.below(2 * stops);
    let mut problem = network(random, stops, links);
    for stop in problem["stops"].as_array_mut().unwrap() {
        stop["town"] = json!(stop["city"] == false && random.one_in(2));
    }
    problem["trains"] = (0..trains)
        .map(|id| train(random, &id.to_string(), stops))
        .collect();
    problem
}

/// A route as the unpruned search lists it: what it is worth, its stops and its track.
struct Listed {
    revenue: i32,
    visits: usize,
    track: Vec<u64>,
}

/// Every route of the train, none dropped for what it is worth.
fn listed(problem: &Problem, train: usize) -> Vec<Listed> {
    let compiled = Compiled::new(problem, f64::INFINITY);
    let network = compiled.network(problem);
    let train = &problem.trains[train];
    let search = network.search(
        train,
        SearchPlan {
            profile: Rc::new(network.profile(train)),
            closed: None,
            deadline: f64::INFINITY,
            memory_budget: usize::MAX,
            selection_bytes_per_candidate: 0,
            best_only: false,
            floor: None,
            streaming: None,
        },
    );
    assert!(!search.exhausted && !search.limited);
    search
        .candidates
        .iter()
        .map(|candidate| {
            let mut track = vec![0; problem.resource_count.div_ceil(64)];
            search
                .candidates
                .resource_bits(candidate, network, &mut track);
            Listed {
                revenue: candidate.revenue,
                visits: candidate.visits,
                track,
            }
        })
        .collect()
}

/// The most the trains earn on routes clear of each other, any of them idle, by trying every
/// choice of listed routes.
fn most(problem: &Problem) -> i32 {
    let lists: Vec<Vec<Listed>> = (0..problem.trains.len())
        .map(|train| listed(problem, train))
        .collect();
    fn choose(lists: &[Vec<Listed>], used: &[u64], longest: usize, bonus: i32) -> i32 {
        let Some((routes, others)) = lists.split_first() else {
            return longest as i32 * bonus;
        };
        routes
            .iter()
            .filter(|route| route.track.iter().zip(used).all(|(a, b)| a & b == 0))
            .map(|route| {
                let used: Vec<u64> = route.track.iter().zip(used).map(|(a, b)| a | b).collect();
                route.revenue + choose(others, &used, longest.max(route.visits), bonus)
            })
            .chain([choose(others, used, longest, bonus)])
            .max()
            .unwrap()
    }
    choose(
        &lists,
        &vec![0; problem.resource_count.div_ceil(64)],
        0,
        problem.longest_route_bonus_per_stop,
    )
}

fn solved(problem: &Problem) -> i32 {
    let solution = solve(problem).unwrap();
    assert!(solution.exhaustive);
    solution.revenue
}

/// What the fleet earns by its outline, as one that listing its routes outright did not settle.
fn outlined(problem: &Problem) -> i32 {
    let started = milliseconds();
    let compiled = Compiled::new(problem, f64::INFINITY);
    let clock = Clock {
        started,
        compile_ms: 0.0,
    };
    let (operation, _) = operate(
        problem,
        &compiled,
        clock,
        started + problem.budget_ms,
        Some((0, vec![])),
    );
    assert!(operation.exhaustive);
    operation.revenue
}

#[test]
fn one_train_earns_what_listing_every_route_finds() {
    let mut random = Random(7 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 1500);
    let mut earning = 0;
    for case in 0..cases {
        let generated = generated(&mut random, 1);
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let found = solved(&problem);
        assert_eq!(found, most(&problem), "case {case}: {generated}");
        earning += usize::from(found > 0);
    }
    assert!(2 * earning > cases, "{earning} of the cases earn anything");
}

#[test]
fn two_trains_earn_what_listing_every_route_finds() {
    let mut random = Random(11 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 500);
    let mut apart = 0;
    for case in 0..cases {
        let mut generated = generated(&mut random, 2);
        if case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let found = solved(&problem);
        assert_eq!(found, most(&problem), "case {case}: {generated}");
        assert_eq!(
            outlined(&problem),
            found,
            "outlined, case {case}: {generated}"
        );
        // The longest route's bonus is no sum of two routes' worth, so the trains are not kept
        // apart: their routes are listed above what the outline leaves worth listing.
        let mut longest = generated.clone();
        longest["longest_route_bonus_per_stop"] = json!(10);
        let longest: Problem = serde_json::from_value(longest).unwrap();
        assert_eq!(
            outlined(&longest),
            most(&longest),
            "outlined with a longest-route bonus, case {case}: {generated}"
        );
        let alone: i32 = (0..2)
            .map(|train| {
                listed(&problem, train)
                    .iter()
                    .map(|route| {
                        route.revenue + route.visits as i32 * problem.longest_route_bonus_per_stop
                    })
                    .max()
                    .unwrap_or(0)
                    .max(0)
            })
            .sum();
        apart += usize::from(found < alone);
    }
    assert!(
        8 * apart > cases,
        "{apart} of the cases have routes in each other's way"
    );
}

#[test]
fn keeping_two_trains_apart_settles_what_listing_every_route_finds() {
    let mut random = Random(13 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 500);
    let mut settled = 0;
    for case in 0..cases {
        let mut generated = generated(&mut random, 2);
        generated["longest_route_bonus_per_stop"] = json!(0);
        if case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let compiled = Compiled::new(&problem, f64::INFINITY);
        let network = compiled.network(&problem);
        let previous: Vec<Option<usize>> = (0..2).map(|id| same_profile(&problem, id)).collect();
        let first = Rc::new(network.profile(&problem.trains[0]));
        let second = match previous[1] {
            Some(_) => Rc::clone(&first),
            None => Rc::new(network.profile(&problem.trains[1])),
        };
        let profiles = [first, second];
        let limits = (f64::INFINITY, usize::MAX);
        let mut outline = network.outline(&profiles, &previous, f64::INFINITY, limits);
        let Some(mut settling) = Settling::new(&problem, &profiles, &outline) else {
            continue;
        };
        settled += 1;
        assert!(
            network.settle(&profiles, &mut outline, &mut settling, limits, None),
            "case {case}: {generated}"
        );
        assert_eq!(outline.revenue, most(&problem), "case {case}: {generated}");
        let routes: Vec<&Lone> = outline.routes.iter().flatten().collect();
        assert_eq!(
            routes.iter().map(|lone| lone.revenue).sum::<i32>(),
            outline.revenue
        );
        if let [first, second] = routes[..] {
            assert!(
                first
                    .track
                    .iter()
                    .zip(&second.track)
                    .all(|(ours, theirs)| ours & theirs == 0),
                "case {case}: {generated}"
            );
        }
    }
    assert!(
        4 * settled > cases,
        "{settled} of the cases have two trains that run"
    );
}
