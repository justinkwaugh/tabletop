use rail_route_solver::solve_json;
use serde_json::{Value, json};

fn solve(problem: &Value) -> Value {
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(problem).unwrap())).unwrap();
    assert!(result.get("error").is_none(), "{result}");
    assert_eq!(result["exhaustive"], true);
    result
}

fn graph(nodes: usize, edges: &[(usize, usize)], trains: &[u32]) -> Value {
    json!({
        "version": 12, "junction_count": 1, "budget_ms": 30000, "memory_budget_bytes": 48_000_000,
        "resource_count": edges.len(), "group_count": 1, "hex_bonuses": vec![0; edges.len()],
        "stops": (0..nodes).map(|id| json!({
            "token": id == 0, "blocked": false, "endpoint": true, "allowed": true,
            "city": true, "town": false, "hex": 0, "groups": [],
        })).collect::<Vec<_>>(),
        "trains": trains.iter().enumerate().map(|(id, distance)| json!({
            "id": id.to_string(), "distance": distance, "crossing_costs": [0, 0, 0], "requires_city": false, "visit_costs": vec![1; nodes],
            "revenues": (0..nodes).map(|n| 10 * (n + 1)).collect::<Vec<_>>(),
            "first_bonus": vec![0; nodes],
        })).collect::<Vec<_>>(),
        "arcs": edges.iter().enumerate().flat_map(|(id, &(a, b))| [(a,b),(b,a)].map(|(from,to)| json!({
            "from": from, "to": to, "next": [], "junctions": [], "resources": [id], "path": id, "hex": id, "crossings": 0, "terminal": false,
        }))).collect::<Vec<_>>(),
    })
}

#[test]
fn station_can_be_interior_and_routes_may_share_the_station() {
    let p = graph(3, &[(0, 1), (0, 2)], &[3]);
    assert_eq!(solve(&p)["revenue"], 60);
    let p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    assert_eq!(solve(&p)["revenue"], 70);
}

#[test]
fn track_cannot_be_reused_across_trains() {
    let p = graph(3, &[(0, 1), (1, 2)], &[3, 3]);
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn express_trains_pay_a_station_and_optimize_paid_connection_bonuses() {
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[5]);
    p["trains"][0]["revenues"] = json!([10, 30, 40, 50, 60]);
    p["trains"][0]["paying_stop_limit"] = json!(3);
    p["trains"][0]["require_paying_token"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 120);
    p["trains"][0]["connection_bonuses"] = json!([{
        "from": [null, 70, null, null, null],
        "to": [null, null, null, null, 50],
    }]);
    assert_eq!(solve(&p)["revenue"], 220);
    p["trains"][0]["paying_stop_limit"] = json!(2);
    assert_eq!(solve(&p)["revenue"], 70);
    p["trains"][0]["require_paying_token"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 210);
}

#[test]
fn longest_route_bonus_is_paid_once_for_the_fleet() {
    let mut p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    p["longest_route_bonus_per_stop"] = json!(10);
    assert_eq!(solve(&p)["revenue"], 90);
}

#[test]
fn large_longest_route_bonus_is_not_added_twice_in_selection_bounds() {
    let mut p = graph(3, &[(0, 1), (0, 2)], &[3, 2]);
    p["longest_route_bonus_per_stop"] = json!(500_000_000);
    assert_eq!(solve(&p)["revenue"], 1_500_000_060);
}

#[test]
fn longest_route_bonus_influences_single_train_candidate_selection() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["revenues"] = json!([10, 20, 0]);
    p["longest_route_bonus_per_stop"] = json!(10);
    assert_eq!(solve(&p)["revenue"], 60);
    assert_eq!(
        solve(&p)["routes"][0]["connections"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn mixed_fleets_with_repeated_profiles_match_the_permutation_oracle() {
    let edges = [(0, 1), (0, 2), (0, 3), (1, 2), (2, 3)];
    for trains in [&[3, 2, 3, 4][..], &[4, 4, 4, 4], &[2, 3, 2, 3, 2]] {
        let mut p = graph(4, &edges, trains);
        for bonus in [0, 10, 100] {
            p["longest_route_bonus_per_stop"] = json!(bonus);
            assert_eq!(
                solve(&p)["revenue"].as_i64().unwrap(),
                exhaustive_oracle(&p, &edges),
                "{p}"
            );
        }
    }
}

#[test]
fn candidate_and_resource_bitsets_span_multiple_words() {
    let edges: Vec<_> = (1..=130).map(|stop| (0, stop)).collect();
    let p = graph(131, &edges, &[2, 2, 2, 2]);
    let result = solve(&p);
    assert_eq!(result["revenue"], 5220);
    let routes = result["routes"].as_array().unwrap();
    assert_eq!(routes.len(), 4);
    assert_eq!(
        routes
            .iter()
            .map(|route| route["connections"][0]["paths"][0].as_u64().unwrap())
            .collect::<std::collections::HashSet<_>>()
            .len(),
        4
    );
}

#[test]
fn longest_route_bonus_can_outweigh_all_higher_revenue_candidates() {
    let mut p = graph(6, &[(0, 1), (0, 2), (0, 3), (3, 4), (4, 5)], &[4, 2]);
    p["trains"][0]["revenues"] = json!([0, 100, 100, 0, 0, 0]);
    p["trains"][1]["revenues"] = json!([0, 1, 1, 0, 0, 0]);
    p["longest_route_bonus_per_stop"] = json!(300);
    assert_eq!(solve(&p)["revenue"], 1301);
    assert_eq!(
        solve(&p)["revenue"].as_i64().unwrap(),
        exhaustive_oracle(&p, &[(0, 1), (0, 2), (0, 3), (3, 4), (4, 5)])
    );
}

#[test]
fn different_bonus_spans_do_not_share_candidates() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3, 3]);
    for train in p["trains"].as_array_mut().unwrap() {
        train["revenues"] = json!([100, 0, 100]);
        train["paying_stop_limit"] = json!(2);
        train["connection_bonuses"] = json!([{
            "from": [null, 50, null], "to": [null, null, 0],
        }]);
    }
    p["trains"][1]["bonuses_along_route"] = json!(true);
    let result = solve(&p);
    assert_eq!(result["revenue"], 250);
    assert_eq!(result["routes"][0]["train"], 1);
    p["trains"].as_array_mut().unwrap().reverse();
    let result = solve(&p);
    assert_eq!(result["revenue"], 250);
    assert_eq!(result["routes"][0]["train"], 0);
}

#[test]
fn blocked_city_is_an_endpoint_and_cannot_be_crossed() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][1]["blocked"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn forbidden_endpoints_may_be_visited_internally() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][1]["endpoint"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 60);
    p["stops"][2]["allowed"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 0);
}

#[test]
fn groups_and_weighted_visits_limit_paths() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][0]["groups"] = json!([0]);
    p["stops"][2]["groups"] = json!([0]);
    assert_eq!(solve(&p)["revenue"], 30);
    p["stops"][2]["groups"] = json!([]);
    p["trains"][0]["visit_costs"][2] = json!(2);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn traversal_bonuses_are_paid_once_per_hex() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["hex_bonuses"] = json!([25]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["hex"] = json!(0);
    }
    assert_eq!(solve(&p)["revenue"], 85);
}

#[test]
fn first_bonus_respects_route_direction() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["first_bonus"] = json!([10, 0, 40]);
    let result = solve(&p);
    assert_eq!(result["revenue"], 100);
    assert_eq!(result["routes"][0]["connections"][0]["from"], 2);
}

#[test]
fn edge_ports_only_connect_through_the_neighbor() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["revenues"] = json!([10, 100, 30]);
    p["arcs"] = json!([
        {"from": 0, "to": null, "next": [4], "junctions": [], "resources": [0], "path": 0, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 0, "next": [], "junctions": [], "resources": [0], "path": 0, "hex": 0, "crossings": 0, "terminal": false},
        {"from": 1, "to": null, "next": [4], "junctions": [], "resources": [0], "path": 1, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 1, "next": [], "junctions": [], "resources": [0], "path": 1, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 2, "next": [], "junctions": [], "resources": [1], "path": 2, "hex": 1, "crossings": 0, "terminal": false},
        {"from": 2, "to": null, "next": [1,3], "junctions": [], "resources": [1], "path": 2, "hex": 1, "crossings": 0, "terminal": false}
    ]);
    assert_eq!(solve(&p)["revenue"], 40);
}

#[test]
fn terminal_track_may_be_last_but_not_internal() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["arcs"][2]["terminal"] = json!(true);
    p["arcs"][3]["terminal"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 60);
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[4]);
    p["arcs"][2]["terminal"] = json!(true);
    p["arcs"][3]["terminal"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn terminal_link_is_run_on_from_a_station_on_its_near_side() {
    let link = |edges: &[(usize, usize)], link_arcs: [usize; 2], token: usize| {
        let mut p = graph(3, edges, &[3]);
        for arc in link_arcs {
            p["arcs"][arc]["terminal"] = json!(true);
            p["arcs"][arc]["departs_terminal"] = json!(true);
        }
        for stop in 0..3 {
            p["stops"][stop]["token"] = json!(stop == token);
        }
        p
    };
    assert_eq!(solve(&link(&[(0, 1), (1, 2)], [2, 3], 0))["revenue"], 60);
    assert_eq!(solve(&link(&[(0, 1), (1, 2)], [2, 3], 2))["revenue"], 50);
    assert_eq!(solve(&link(&[(0, 1), (1, 2)], [0, 1], 2))["revenue"], 60);
}

fn permutations(remaining: &mut Vec<usize>, prefix: &mut Vec<usize>, result: &mut Vec<Vec<usize>>) {
    if prefix.len() >= 2 {
        result.push(prefix.clone());
    }
    for i in 0..remaining.len() {
        let item = remaining.remove(i);
        prefix.push(item);
        permutations(remaining, prefix, result);
        prefix.pop();
        remaining.insert(i, item);
    }
}

fn exhaustive_oracle(p: &Value, edges: &[(usize, usize)]) -> i64 {
    let stops = p["stops"].as_array().unwrap();
    let mut paths = vec![];
    permutations(&mut (0..stops.len()).collect(), &mut vec![], &mut paths);
    let mut candidates = vec![];
    for train in p["trains"].as_array().unwrap() {
        let mut choices = vec![(0, 0u64, 0usize, 0u64)];
        for path in &paths {
            if !path.iter().any(|&n| stops[n]["token"] == true)
                || path.iter().any(|&n| stops[n]["allowed"] == false)
                || stops[path[0]]["endpoint"] == false
                || stops[*path.last().unwrap()]["endpoint"] == false
                || path[1..path.len() - 1]
                    .iter()
                    .any(|&n| stops[n]["blocked"] == true)
                || path
                    .iter()
                    .map(|&n| train["visit_costs"][n].as_u64().unwrap())
                    .sum::<u64>()
                    > train["distance"].as_u64().unwrap()
                || train["major_limit"].as_u64().is_some_and(|limit| {
                    path.iter().filter(|&&n| stops[n]["town"] != true).count() as u64 > limit
                })
            {
                continue;
            }
            let all_groups: Vec<_> = path
                .iter()
                .flat_map(|&n| {
                    stops[n]["groups"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|g| g.as_u64().unwrap())
                })
                .collect();
            if all_groups
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                != all_groups.len()
            {
                continue;
            }
            let route_edges: Option<Vec<_>> = path
                .windows(2)
                .map(|pair| {
                    edges.iter().position(|&(a, b)| {
                        (a == pair[0] && b == pair[1]) || (a == pair[1] && b == pair[0])
                    })
                })
                .collect();
            let Some(route_edges) = route_edges else {
                continue;
            };
            // The paying limit chooses among the counted stops; uncounted ones always pay.
            let uncounted = |node: usize| train["uncounted"][node].as_bool() == Some(true);
            let counted: Vec<usize> = (0..path.len()).filter(|&i| !uncounted(path[i])).collect();
            let paying_count = train["paying_stop_limit"]
                .as_u64()
                .map_or(counted.len(), |n| n as usize)
                .min(counted.len());
            let paid_revenue = (0u64..1 << counted.len())
                .filter(|bits| bits.count_ones() as usize == paying_count)
                .filter_map(|bits| {
                    let chosen = |index: usize| {
                        counted
                            .iter()
                            .position(|&at| at == index)
                            .is_some_and(|k| bits & (1 << k) != 0)
                    };
                    let paid: Vec<_> = path
                        .iter()
                        .enumerate()
                        .filter(|&(index, &node)| uncounted(node) || chosen(index))
                        .map(|(_, &node)| node)
                        .collect();
                    if train["require_paying_token"] == true
                        && !paid.iter().any(|&node| stops[node]["token"] == true)
                    {
                        return None;
                    }
                    let mut revenue = paid
                        .iter()
                        .map(|&node| train["revenues"][node].as_i64().unwrap())
                        .sum::<i64>();
                    if let Some(bonuses) = train["connection_bonuses"].as_array() {
                        for bonus in bonuses {
                            let from = paid
                                .iter()
                                .filter_map(|&node| bonus["from"][node].as_i64())
                                .max();
                            let to = paid
                                .iter()
                                .filter(|&&node| {
                                    bonus["ends_only"] != true
                                        || node == path[0]
                                        || node == path[path.len() - 1]
                                })
                                .filter_map(|&node| bonus["to"][node].as_i64())
                                .max();
                            if let (Some(from), Some(to)) = (from, to) {
                                revenue += from + to;
                            }
                        }
                    }
                    Some(revenue)
                })
                .max()
                .unwrap();
            let revenue: i64 = paid_revenue
                + route_edges
                    .iter()
                    .map(|&e| p["hex_bonuses"][e].as_i64().unwrap())
                    .sum::<i64>()
                + path
                    .iter()
                    .map(|&n| train["first_bonus"][n].as_i64().unwrap())
                    .find(|&b| b != 0)
                    .unwrap_or(0);
            choices.push((
                revenue,
                route_edges.iter().fold(0u64, |bits, &e| bits | (1 << e)),
                path.len(),
                all_groups.iter().fold(0u64, |bits, &g| bits | (1 << g)),
            ));
        }
        candidates.push(choices);
    }
    // The stop groups that only so many routes may stop in, and how many of the routes chosen do.
    struct Limits {
        most: Vec<(u64, usize)>,
        held: Vec<usize>,
        bonus: i64,
    }
    fn product(
        lists: &[Vec<(i64, u64, usize, u64)>],
        used: u64,
        longest: usize,
        limits: &mut Limits,
    ) -> i64 {
        if lists.is_empty() {
            return longest as i64 * limits.bonus;
        }
        let mut best = i64::MIN;
        for &(value, bits, visits, groups) in &lists[0] {
            let stops_in: Vec<bool> = limits
                .most
                .iter()
                .map(|&(group, _)| groups >> group & 1 == 1)
                .collect();
            let full = (0..stops_in.len())
                .any(|limit| stops_in[limit] && limits.held[limit] == limits.most[limit].1);
            if bits & used != 0 || full {
                continue;
            }
            for (held, &stops_in) in limits.held.iter_mut().zip(&stops_in) {
                *held += usize::from(stops_in);
            }
            best = best.max(value + product(&lists[1..], used | bits, longest.max(visits), limits));
            for (held, &stops_in) in limits.held.iter_mut().zip(&stops_in) {
                *held -= usize::from(stops_in);
            }
        }
        best
    }
    let most: Vec<(u64, usize)> = p["group_route_limits"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|limit| {
            (
                limit["group"].as_u64().unwrap(),
                limit["routes"].as_u64().unwrap() as usize,
            )
        })
        .collect();
    product(
        &candidates,
        0,
        0,
        &mut Limits {
            held: vec![0; most.len()],
            most,
            bonus: p["longest_route_bonus_per_stop"].as_i64().unwrap_or(0),
        },
    )
}

/// How many of the solution's routes stop in the group.
fn routes_stopping_in(p: &Value, solution: &Value, group: u64) -> usize {
    solution["routes"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|route| {
            route["connections"].as_array().unwrap().iter().any(|link| {
                [&link["from"], &link["to"]].iter().any(|stop| {
                    p["stops"][stop.as_u64().unwrap() as usize]["groups"]
                        .as_array()
                        .unwrap()
                        .contains(&json!(group))
                })
            })
        })
        .count()
}

#[test]
fn only_so_many_routes_stop_in_a_limited_group() {
    let spokes: Vec<_> = (1..7).map(|stop| (0, stop)).collect();
    for trains in [&[2, 2, 2, 2][..], &[2, 3, 2, 3], &[3, 2, 2, 2, 2]] {
        let mut p = graph(7, &spokes, trains);
        p["group_count"] = json!(2);
        for stop in [5, 6] {
            p["stops"][stop]["groups"] = json!([0]);
        }
        for stop in [2, 3, 4] {
            p["stops"][stop]["groups"] = json!([1]);
        }
        let unlimited = solve(&p);
        assert_eq!(routes_stopping_in(&p, &unlimited, 0), 2, "{trains:?}");
        assert!(routes_stopping_in(&p, &unlimited, 1) > 0, "{trains:?}");
        p["group_route_limits"] = json!([{"group": 0, "routes": 1}, {"group": 1, "routes": 2}]);
        let limited = solve(&p);
        assert!(routes_stopping_in(&p, &limited, 0) <= 1, "{trains:?}");
        assert!(routes_stopping_in(&p, &limited, 1) <= 2, "{trains:?}");
        assert!(limited["revenue"].as_i64() < unlimited["revenue"].as_i64());
        assert_eq!(
            limited["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &spokes),
            "{trains:?}"
        );
        for bonus in [10, 100] {
            p["longest_route_bonus_per_stop"] = json!(bonus);
            assert_eq!(
                solve(&p)["revenue"].as_i64().unwrap(),
                exhaustive_oracle(&p, &spokes),
                "{trains:?} with a longest-route bonus of {bonus}"
            );
        }
    }
    let mut p = graph(7, &spokes, &[2, 2]);
    p["stops"][6]["groups"] = json!([0]);
    p["group_route_limits"] = json!([{"group": 0, "routes": 0}]);
    assert_eq!(solve(&p)["revenue"], 130);
    p["group_route_limits"] = json!([{"group": 1, "routes": 1}]);
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert_eq!(result["error"], "Invalid stop group limit");
}

#[test]
fn limited_groups_agree_with_the_permutation_oracle_on_generated_graphs() {
    let mut seed = 57u64;
    let mut random = || {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        seed >> 32
    };
    let mut bound = 0;
    let cases = 150;
    for case in 0..cases {
        let mut edges = vec![];
        for a in 0..5 {
            for b in a + 1..5 {
                if random() % 4 != 0 {
                    edges.push((a, b));
                }
            }
        }
        let trains: Vec<u32> = (0..2 + case % 3)
            .map(|_| 2 + (random() % 3) as u32)
            .collect();
        let mut p = graph(5, &edges, &trains);
        p["group_count"] = json!(2);
        for stop in p["stops"].as_array_mut().unwrap() {
            stop["blocked"] = json!(random() % 6 == 0);
            stop["endpoint"] = json!(random() % 6 != 0);
            stop["token"] = json!(stop["token"] == true || random() % 3 == 0);
            if random() % 3 != 0 {
                stop["groups"] = json!([random() % 2]);
            }
        }
        for train in p["trains"].as_array_mut().unwrap() {
            for revenue in train["revenues"].as_array_mut().unwrap() {
                *revenue = json!(10 + random() % 10 * 10);
            }
        }
        if case % 4 == 0 {
            p["trains"][1] = p["trains"][0].clone();
            p["trains"][1]["id"] = json!("1");
        }
        let unlimited = exhaustive_oracle(&p, &edges);
        let mut limits = vec![];
        for group in 0..2 {
            if random() % 5 != 0 {
                limits.push(json!({"group": group, "routes": random() % trains.len() as u64}));
            }
        }
        p["group_route_limits"] = json!(limits);
        for bonus in [0, (case % 3) * 10] {
            p["longest_route_bonus_per_stop"] = json!(bonus);
            let most = exhaustive_oracle(&p, &edges);
            let solution = solve(&p);
            assert_eq!(
                solution["revenue"].as_i64().unwrap(),
                most,
                "case {case}: {p}"
            );
            for limit in p["group_route_limits"].as_array().unwrap() {
                assert!(
                    routes_stopping_in(&p, &solution, limit["group"].as_u64().unwrap())
                        <= limit["routes"].as_u64().unwrap() as usize,
                    "case {case}: {p}"
                );
            }
            bound += usize::from(bonus == 0 && most < unlimited);
        }
    }
    assert!(3 * bound > cases, "a limit bound {bound} of the cases");
}

#[test]
fn agrees_with_unpruned_permutation_oracle_on_200_graphs() {
    let mut seed = 91u64;
    let mut random = || {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        seed >> 32
    };
    for case in 0..200 {
        let mut edges = vec![];
        for a in 0..5 {
            for b in a + 1..5 {
                if random() % 3 != 0 {
                    edges.push((a, b));
                }
            }
        }
        let mut p = graph(
            5,
            &edges,
            &[2 + (random() % 4) as u32, 2 + (random() % 4) as u32],
        );
        for stop in p["stops"].as_array_mut().unwrap() {
            stop["blocked"] = json!(random() % 5 == 0);
            stop["endpoint"] = json!(random() % 5 != 0);
            stop["allowed"] = json!(random() % 8 != 0);
            stop["town"] = json!(random() % 3 == 0);

            if random() % 3 == 0 {
                stop["groups"] = json!([0]);
            }
        }
        for bonus in p["hex_bonuses"].as_array_mut().unwrap() {
            *bonus = json!(random() % 3 * 10);
        }
        for train in p["trains"].as_array_mut().unwrap() {
            for cost in train["visit_costs"].as_array_mut().unwrap() {
                *cost = json!(random() % 3);
            }
            for revenue in train["revenues"].as_array_mut().unwrap() {
                *revenue = json!(10 + random() % 10 * 10);
            }
            for bonus in train["first_bonus"].as_array_mut().unwrap() {
                *bonus = json!(random() % 3 * 10);
            }
        }
        assert_eq!(
            solve(&p)["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &edges),
            "case {case}: {p}"
        );
        p["longest_route_bonus_per_stop"] = json!((case % 3) * 10);
        for (id, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            train["paying_stop_limit"] = json!(1 + (case + id) % 4);
            if (case + id) % 3 == 0 {
                train["uncounted"] = json!((0..5).map(|node| node == case % 5).collect::<Vec<_>>());
            }
            train["require_paying_token"] = json!(case % 2 == 0);
            train["connection_bonuses"] = json!([{
                "from": [0, 30, null, null, null],
                "to": [null, null, 20, null, 50],
                "ends_only": (case + id) % 3 == 0,
            }]);
            if (case + id) % 2 == 0 {
                train["major_limit"] = json!(1 + case % 3);
            }
        }
        assert_eq!(
            solve(&p)["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &edges),
            "scored case {case}: {p}"
        );
    }
}

#[test]
fn asymmetric_connectivity_is_rejected() {
    let mut p = graph(2, &[(0, 1)], &[2]);
    p["arcs"][1]["to"] = json!(1);
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert_eq!(result["error"], "Track connectivity must be reversible");
}

#[test]
fn interrupted_search_does_not_claim_exhaustion() {
    let edges: Vec<_> = (0..9)
        .flat_map(|a| (a + 1..9).map(move |b| (a, b)))
        .collect();
    for trains in [&[9, 9][..], &[3, 9], &[9, 3]] {
        let mut p = graph(9, &edges, trains);
        p["budget_ms"] = json!(0.001);
        let result: Value =
            serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
        assert!(result.get("error").is_none());
        assert_eq!(result["exhaustive"], false);
        assert_eq!(result["path_exhaustive"], false);
        assert_eq!(result["memory_limited"], false);
    }
}

#[test]
fn zero_cost_towns_do_not_consume_city_capacity() {
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[2]);
    p["trains"][0]["visit_costs"] = json!([0, 1, 0, 1, 0]);
    assert_eq!(solve(&p)["revenue"], 150);
}

#[test]
fn crossing_capacity_is_independent_of_visits() {
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[2]);
    p["trains"][0]["crossing_costs"] = json!([1, 1, 1]);
    p["trains"][0]["visit_costs"] = json!([0, 0, 0, 0]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["crossings"] = json!(1);
    }
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn required_city_is_separate_from_the_station_requirement() {
    let mut p = graph(2, &[(0, 1)], &[2]);
    p["trains"][0]["requires_city"] = json!(true);
    for stop in p["stops"].as_array_mut().unwrap() {
        stop["city"] = json!(false);
    }
    assert_eq!(solve(&p)["revenue"], 0);
    p["stops"][1]["city"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn junction_cannot_be_revisited_between_stops() {
    let mut p = graph(2, &[(0, 1); 4], &[2]);
    for id in 0..4 {
        let fwd = id * 2;
        let rev = fwd + 1;
        p["arcs"][fwd]["from"] = if id == 0 { json!(0) } else { Value::Null };
        p["arcs"][fwd]["to"] = if id == 3 { json!(1) } else { Value::Null };
        p["arcs"][fwd]["next"] = if id == 3 { json!([]) } else { json!([fwd + 2]) };
        p["arcs"][rev]["to"] = p["arcs"][fwd]["from"].clone();
        p["arcs"][rev]["from"] = p["arcs"][fwd]["to"].clone();
        p["arcs"][rev]["next"] = if id == 0 { json!([]) } else { json!([rev - 2]) };
    }
    p["arcs"][0]["junctions"] = json!([0]);
    p["arcs"][1]["junctions"] = json!([0]);
    p["arcs"][2]["junctions"] = json!([0]);
    p["arcs"][3]["junctions"] = json!([0]);
    assert_eq!(solve(&p)["revenue"], 30);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 0);
}

#[test]
fn junction_can_be_revisited_after_another_stop_and_by_another_train() {
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[4]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 100);
    let mut p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 70);
}

#[test]
fn extra_town_trains_limit_stops_other_than_towns() {
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[5]);
    p["stops"][1]["town"] = json!(true);
    p["stops"][3]["town"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 150);
    p["trains"][0]["major_limit"] = json!(2);
    assert_eq!(solve(&p)["revenue"], 100);
    p["trains"][0]["major_limit"] = json!(3);
    assert_eq!(solve(&p)["revenue"], 150);
}

#[test]
fn end_only_destinations_pay_at_a_route_end() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["connection_bonuses"] = json!([{
        "from": [50, null, null],
        "to": [null, 0, null],
    }]);
    assert_eq!(solve(&p)["revenue"], 110);
    p["trains"][0]["connection_bonuses"][0]["ends_only"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 80);
}

fn interconnected(edges: &[(usize, usize)], trains: &[u32]) -> Value {
    let mut p = graph(4, edges, trains);
    for (id, stop) in p["stops"].as_array_mut().unwrap().iter_mut().enumerate() {
        stop["hex"] = json!(id);
    }
    p["hex_bonuses"] = json!([0, 0, 0, 0]);
    for train in p["trains"].as_array_mut().unwrap() {
        train["interconnections"] = json!([{ "from": [0], "to": [3], "amount": 100 }]);
    }
    p
}

#[test]
fn extensions_pass_blocked_cities_to_an_interconnection() {
    let mut p = interconnected(&[(0, 1), (1, 2), (2, 3)], &[2]);
    let result = solve(&p);
    assert_eq!(result["revenue"], 130);
    assert_eq!(result["routes"][0]["extension"], json!([1, 2]));
    p["stops"][2]["blocked"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 130);
    p["stops"][2]["city"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 30);
    p["stops"][2]["town"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 130);
    p["stops"][2]["allowed"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn extensions_hang_off_either_end_and_consume_fleet_track() {
    let p = interconnected(&[(0, 1), (1, 2), (0, 3)], &[2]);
    let result = solve(&p);
    assert_eq!(result["revenue"], 130);
    assert_eq!(result["routes"][0]["connections"][0]["from"], 1);
    assert_eq!(result["routes"][0]["extension"], json!([2]));
    let p = interconnected(&[(0, 1), (1, 2), (0, 3)], &[2, 2]);
    assert_eq!(solve(&p)["revenue"], 130);
    let mut p = interconnected(&[(0, 1), (1, 2), (0, 3)], &[2]);
    p["trains"][0]["interconnections"][0]["from"] = json!([2]);
    assert_eq!(solve(&p)["revenue"], 50);
}

#[test]
fn a_second_pass_above_the_first_answer_proves_a_two_train_fleet_cut_for_memory() {
    let edges: Vec<_> = (0..8)
        .flat_map(|a| (a + 1..8).map(move |b| (a, b)))
        .collect();
    for trains in [&[5, 4][..], &[4, 5], &[4, 4], &[5, 5]] {
        let full = solve(&graph(8, &edges, trains));
        let mut p = graph(8, &edges, trains);
        p["memory_budget_bytes"] = json!(64 * 1024);
        let proven = solve(&p);
        assert_eq!(proven["memory_limited"], false, "{trains:?}");
        assert_eq!(proven["revenue"], full["revenue"], "{trains:?}");
    }
}

#[test]
fn a_fleet_cut_for_memory_in_both_passes_reports_it_and_keeps_a_legal_operation() {
    // The longest-route bonus makes every route valuable enough that the second pass is cut too,
    // after compilation completed.
    let edges: Vec<_> = (0..8)
        .flat_map(|a| (a + 1..8).map(move |b| (a, b)))
        .collect();
    for trains in [&[6, 5][..], &[5, 5]] {
        let mut p = graph(8, &edges, trains);
        p["longest_route_bonus_per_stop"] = json!(101);
        let full = solve(&p);
        p["memory_budget_bytes"] = json!(64 * 1024);
        let limited: Value =
            serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
        assert!(limited.get("error").is_none(), "{limited}");
        assert_eq!(full["memory_limited"], false);
        assert_eq!(limited["memory_limited"], true, "{trains:?}");
        assert_eq!(limited["exhaustive"], false);
        assert!(limited["revenue"].as_i64().unwrap() > 0);
        assert!(limited["revenue"].as_i64() <= full["revenue"].as_i64());
        // Each train runs at most once and no piece of track is used twice.
        let routes = limited["routes"].as_array().unwrap();
        let mut trains_run: Vec<_> = routes
            .iter()
            .map(|r| r["train"].as_u64().unwrap())
            .collect();
        trains_run.dedup();
        assert_eq!(trains_run.len(), routes.len());
        let mut paths: Vec<_> = routes
            .iter()
            .flat_map(|r| r["connections"].as_array().unwrap())
            .flat_map(|c| c["paths"].as_array().unwrap())
            .map(|path| path.as_u64().unwrap())
            .collect();
        let used = paths.len();
        paths.sort_unstable();
        paths.dedup();
        assert_eq!(paths.len(), used);
    }
}

#[test]
fn a_second_pass_bounds_a_stored_train_when_the_other_cannot_run() {
    // The distance-5 train pays 3 for every stop, so it cannot reach a second stop; it adds
    // nothing, and the stored train's best route alone is proven best.
    let edges: Vec<_> = (0..8)
        .flat_map(|a| (a + 1..8).map(move |b| (a, b)))
        .collect();
    for (trains, idle) in [(&[4, 5][..], 1), (&[5, 4], 0)] {
        let mut p = graph(8, &edges, trains);
        p["trains"][idle]["visit_costs"] = json!(vec![3; 8]);
        let full = solve(&p);
        p["memory_budget_bytes"] = json!(64 * 1024);
        let proven = solve(&p);
        assert_eq!(proven["memory_limited"], false, "{trains:?}");
        assert_eq!(proven["revenue"], full["revenue"], "{trains:?}");
    }
}

#[test]
fn streaming_retains_the_smaller_profile_in_either_input_order() {
    let edges: Vec<_> = (0..8)
        .flat_map(|a| (a + 1..8).map(move |b| (a, b)))
        .collect();
    for trains in [&[4, 3][..], &[3, 4]] {
        let mut p = graph(8, &edges, trains);
        let full = solve(&p);
        p["memory_budget_bytes"] = json!(64 * 1024);
        let streamed = solve(&p);
        assert_eq!(streamed["memory_limited"], false);
        assert_eq!(streamed["revenue"], full["revenue"]);
        assert_eq!(streamed["candidates"], full["candidates"]);
    }
}

#[test]
fn streaming_mixed_profiles_allow_either_train_to_run_alone() {
    let edges = [(0, 1), (1, 2), (2, 3)];
    for trains in [&[2, 4][..], &[4, 2]] {
        let mut p = graph(4, &edges, trains);
        for revenues in [[100, 0], [0, 100]] {
            for (id, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
                train["revenues"] = json!(vec![revenues[id]; 4]);
            }
            for bonus in [0, 10, 100] {
                p["longest_route_bonus_per_stop"] = json!(bonus);
                assert_eq!(
                    solve(&p)["revenue"].as_i64().unwrap(),
                    exhaustive_oracle(&p, &edges)
                );
            }
        }
        p["trains"][0]["distance"] = json!(1);
        assert_eq!(
            solve(&p)["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &edges)
        );
    }
}

// Two stations joined by `k` diamonds of junction track: 2^k distinct paths each way.
fn diamonds(k: usize) -> Value {
    let edges: Vec<_> = (0..k).flat_map(|level| [(level, level + 1); 2]).collect();
    let stop = |level: usize| match level {
        0 => json!(0),
        l if l == k => json!(1),
        _ => Value::Null,
    };
    let ends = |arc: usize| {
        let (a, b) = edges[arc / 2];
        if arc.is_multiple_of(2) {
            (a, b)
        } else {
            (b, a)
        }
    };
    let arcs: Vec<_> = (0..edges.len() * 2)
        .map(|arc| {
            let (from, to) = ends(arc);
            let next: Vec<_> = if stop(to).is_null() {
                (0..edges.len() * 2)
                    .filter(|&other| other != arc ^ 1 && ends(other).0 == to)
                    .collect()
            } else {
                vec![]
            };
            let junctions: Vec<_> = [from.min(to), from.max(to)]
                .into_iter()
                .filter(|&level| level > 0 && level < k)
                .map(|level| level - 1)
                .collect();
            json!({
                "from": stop(from), "to": stop(to), "next": next, "junctions": junctions,
                "resources": [arc / 2], "path": arc / 2, "hex": 0, "crossings": 0, "terminal": false,
            })
        })
        .collect();
    let mut p = graph(2, &[], &[2]);
    p["resource_count"] = json!(edges.len());
    p["junction_count"] = json!(k - 1);
    p["hex_bonuses"] = json!([0]);
    p["arcs"] = json!(arcs);
    p
}

#[test]
fn compilation_stops_at_its_share_of_the_memory_budget() {
    let full = solve(&diamonds(10));
    assert_eq!(full["connections"], 2 * 1024);
    let mut p = diamonds(14);
    p["memory_budget_bytes"] = json!(256 * 1024);
    let limited: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert!(limited.get("error").is_none(), "{limited}");
    assert_eq!(limited["memory_limited"], true);
    assert_eq!(limited["exhaustive"], false);
    assert!(limited["connections"].as_u64().unwrap() < 2 * 16384);
    assert_eq!(limited["revenue"], full["revenue"]);
}

#[test]
fn wide_connection_ids_preserve_the_small_graph_oracle() {
    let edges = [(0, 1), (0, 2)];
    let mut p = graph(3, &edges, &[2, 2]);
    let optimum = exhaustive_oracle(&p, &edges);
    let arcs = p["arcs"].as_array().unwrap();
    let mut wide = Vec::with_capacity(65538);
    for _ in 0..32768 {
        wide.extend_from_slice(&arcs[..2]);
    }
    wide.extend_from_slice(&arcs[2..]);
    p["arcs"] = json!(wide);
    p["memory_budget_bytes"] = json!(128 * 1024 * 1024);
    let result = solve(&p);
    assert_eq!(result["connections"], 65538);
    assert_eq!(result["revenue"], optimum);
    assert_eq!(result["exhaustive"], true);
    assert_eq!(result["memory_limited"], false);
    assert!(result["routes"].as_array().unwrap().iter().any(|route| {
        route["connections"]
            .as_array()
            .unwrap()
            .iter()
            .any(|connection| connection["paths"] == json!([1]))
    }));
}

fn fleet_graph(nodes: usize, edges: &[(usize, usize)], distances: &[u32]) -> Value {
    let mut p = graph(nodes, edges, distances);
    let hexes = nodes.max(edges.len());
    p["hex_bonuses"] = json!(vec![0; hexes]);
    for (id, stop) in p["stops"].as_array_mut().unwrap().iter_mut().enumerate() {
        stop["hex"] = json!(id);
        stop["token"] = json!(true);
    }
    p["fleet"] = json!({
        "shared_track": true, "pay_once": true,
        "payment_groups": (0..nodes).collect::<Vec<_>>(),
        "connectivity": { "root": 0, "stops": vec![true; nodes] },
        "minimum_cities": 1,
        "coordinates": (0..hexes).map(|q| json!({"q": q, "r": 0})).collect::<Vec<_>>(),
        "bonus_per_hex": 20, "end_rates": vec![20; nodes], "offboard_distance": false,
    });
    for train in p["trains"].as_array_mut().unwrap() {
        train["allowed_stops"] = json!(vec![true; nodes]);
        train["fleet"] = json!({
            "paying": vec![true; nodes], "limited": vec![false; nodes],
            "paying_limit": null, "hex_subsidy": 0, "freight": null,
        });
    }
    p
}

#[derive(Clone)]
struct OracleRoute {
    stops: Vec<usize>,
    /// The stops the train calls at, which pay.
    called: Vec<usize>,
    edges: Vec<usize>,
    train: usize,
    subsidy: i64,
    passes: u64,
}

fn flag(list: &Value, index: usize) -> bool {
    list.get(index) == Some(&json!(true))
}

/// The stops a train calls at on a route: its ends and every stop it may not pass, then the
/// others worth most, revenue and subsidy together, ties by revenue then order, while it can;
/// none when the stops it must call at are already too far.
fn oracle_called(train: &Value, path: &[usize], crossings: u64) -> Option<Vec<usize>> {
    let last = path.len() - 1;
    let required =
        |index: usize| index == 0 || index == last || !flag(&train["optional"], path[index]);
    let cost = |stop: usize| train["visit_costs"][stop].as_u64().unwrap();
    let revenue = |stop: usize| train["revenues"][stop].as_i64().unwrap();
    let subsidy = |stop: usize| {
        train["subsidies"]
            .get(stop)
            .map_or(0, |s| s.as_i64().unwrap())
    };
    let mut used = crossings
        + (0..path.len())
            .filter(|&index| required(index))
            .map(|index| cost(path[index]))
            .sum::<u64>();
    let distance = train["distance"].as_u64().unwrap();
    if used > distance {
        return None;
    }
    let mut chosen: Vec<_> = (0..path.len()).map(required).collect();
    let mut rest: Vec<_> = (0..path.len())
        .filter(|&index| !chosen[index] && revenue(path[index]) + subsidy(path[index]) > 0)
        .collect();
    // A stable sort: earlier stops win ties.
    rest.sort_by(|&a, &b| {
        let worth = |index: usize| {
            (
                revenue(path[index]) + subsidy(path[index]),
                revenue(path[index]),
            )
        };
        worth(b).cmp(&worth(a))
    });
    for index in rest {
        if used + cost(path[index]) <= distance {
            used += cost(path[index]);
            chosen[index] = true;
        }
    }
    Some(
        (0..path.len())
            .filter(|&index| chosen[index])
            .map(|index| path[index])
            .collect(),
    )
}

fn oracle_fleet(p: &Value, edges: &[(usize, usize)]) -> i64 {
    let stops = p["stops"].as_array().unwrap();
    let trains = p["trains"].as_array().unwrap();
    let mut paths = vec![];
    permutations(&mut (0..stops.len()).collect(), &mut vec![], &mut paths);
    let mut candidates = vec![];
    for (id, train) in trains.iter().enumerate() {
        let mut routes = vec![];
        for path in &paths {
            if path[0] > *path.last().unwrap()
                || !path.iter().any(|&stop| stops[stop]["token"] == true)
                || path.iter().any(|&stop| {
                    stops[stop]["allowed"] == false || train["allowed_stops"][stop] == false
                })
                || stops[path[0]]["endpoint"] == false
                || stops[*path.last().unwrap()]["endpoint"] == false
                || path[1..path.len() - 1].iter().any(|&stop| {
                    stops[stop]["blocked"] == true
                        && stops[stop]["city"] == false
                        && stops[stop]["town"] == false
                })
                || path
                    .iter()
                    .filter(|&&stop| stops[stop]["city"] == true)
                    .count()
                    < p["fleet"]["minimum_cities"].as_u64().unwrap_or(0) as usize
                || (train["requires_city"] == true
                    && !path.iter().any(|&stop| stops[stop]["city"] == true))
            {
                continue;
            }
            let Some(route_edges) = path
                .windows(2)
                .map(|pair| {
                    edges.iter().position(|&(a, b)| {
                        (a == pair[0] && b == pair[1]) || (b == pair[0] && a == pair[1])
                    })
                })
                .collect::<Option<Vec<_>>>()
            else {
                continue;
            };
            let passes = path[1..path.len() - 1]
                .iter()
                .filter(|&&stop| stops[stop]["blocked"] == true)
                .count() as u64;
            if passes > p["blocked_passes"].as_u64().unwrap_or(0) {
                continue;
            }
            if p["no_reentry"] == true {
                let mut hexes = vec![stops[path[0]]["hex"].as_u64().unwrap()];
                for &edge in &route_edges {
                    let hex = p["arcs"][edge * 2]["hex"].as_u64().unwrap();
                    if hexes.last() != Some(&hex) {
                        hexes.push(hex);
                    }
                }
                if hexes
                    .iter()
                    .enumerate()
                    .any(|(i, hex)| hexes[..i].contains(hex))
                {
                    continue;
                }
            }
            let crossing_cost = train["crossing_costs"][0].as_u64().unwrap();
            let crossings: u64 = route_edges
                .iter()
                .map(|&edge| p["arcs"][edge * 2]["crossings"].as_u64().unwrap() * crossing_cost)
                .sum();
            let Some(called) = oracle_called(train, path, crossings) else {
                continue;
            };
            let groups: Vec<_> = path
                .iter()
                .flat_map(|&stop| stops[stop]["groups"].as_array().unwrap().iter())
                .collect();
            if groups
                .iter()
                .enumerate()
                .any(|(i, g)| groups[..i].contains(g))
            {
                continue;
            }
            let subsidy = called
                .iter()
                .map(|&stop| {
                    train["subsidies"]
                        .get(stop)
                        .map_or(0, |s| s.as_i64().unwrap())
                })
                .sum();
            routes.push(OracleRoute {
                stops: path.clone(),
                called,
                edges: route_edges,
                train: id,
                subsidy,
                passes,
            });
        }
        candidates.push(routes);
    }
    fn product(
        p: &Value,
        candidates: &[Vec<OracleRoute>],
        position: usize,
        chosen: &mut Vec<OracleRoute>,
    ) -> i64 {
        if position == candidates.len() {
            return oracle_settlement(p, chosen).unwrap_or(0);
        }
        let mut best = product(p, candidates, position + 1, chosen);
        for route in &candidates[position] {
            if chosen.iter().map(|other| other.passes).sum::<u64>() + route.passes
                > p["blocked_passes"].as_u64().unwrap_or(0)
            {
                continue;
            }
            if p["fleet"]["shared_track"] != true
                && chosen
                    .iter()
                    .any(|other| other.edges.iter().any(|edge| route.edges.contains(edge)))
            {
                continue;
            }
            chosen.push(route.clone());
            best = best.max(product(p, candidates, position + 1, chosen));
            chosen.pop();
        }
        best
    }
    product(p, &candidates, 0, &mut vec![])
}

fn oracle_chain(routes: &[&OracleRoute]) -> Option<(usize, usize)> {
    if routes.is_empty() {
        return None;
    }
    fn extend(
        routes: &[&OracleRoute],
        used: usize,
        end: usize,
        visited: &mut Vec<usize>,
    ) -> Option<usize> {
        if used.count_ones() as usize == routes.len() {
            return Some(end);
        }
        for (index, route) in routes.iter().enumerate() {
            if used & (1 << index) != 0 {
                continue;
            }
            let [a, b] = [route.stops[0], *route.stops.last().unwrap()];
            let next = if a == end {
                b
            } else if b == end {
                a
            } else {
                continue;
            };
            if visited.contains(&next) {
                continue;
            }
            visited.push(next);
            let result = extend(routes, used | (1 << index), next, visited);
            visited.pop();
            if result.is_some() {
                return result;
            }
        }
        None
    }
    for (index, route) in routes.iter().enumerate() {
        let [a, b] = [route.stops[0], *route.stops.last().unwrap()];
        for (start, end) in [(a, b), (b, a)] {
            if let Some(last) = extend(routes, 1 << index, end, &mut vec![start, end]) {
                return Some((start, last));
            }
        }
    }
    None
}

fn oracle_settlement(p: &Value, chosen: &[OracleRoute]) -> Option<i64> {
    if chosen.is_empty() {
        return Some(0);
    }
    let fleet = &p["fleet"];
    let stops = p["stops"].as_array().unwrap();
    let trains = p["trains"].as_array().unwrap();
    if !fleet["connectivity"].is_null() {
        let root = fleet["connectivity"]["root"]
            .as_u64()
            .map(|root| root as usize);
        let mut reach: Vec<_> = chosen
            .iter()
            .enumerate()
            .filter(|(_, route)| root.is_none_or(|root| route.stops.contains(&root)))
            .map(|(i, _)| i)
            .collect();
        if root.is_none() {
            reach = vec![0];
        }
        for _ in 0..chosen.len() {
            for i in 0..chosen.len() {
                if !reach.contains(&i)
                    && reach.iter().any(|&j| {
                        chosen[i].stops.iter().any(|&stop| {
                            fleet["connectivity"]["stops"][stop] == true
                                && chosen[j].stops.contains(&stop)
                        })
                    })
                {
                    reach.push(i);
                }
            }
        }
        if reach.len() != chosen.len() {
            return None;
        }
    }
    let freight: Vec<_> = chosen
        .iter()
        .filter(|route| !trains[route.train]["fleet"]["freight"].is_null())
        .collect();
    let required: Vec<_> = freight
        .iter()
        .copied()
        .filter(|route| trains[route.train]["fleet"]["freight"] == "required")
        .collect();
    if !required.is_empty() && oracle_chain(&required).is_none() {
        return None;
    }
    let mut sets = vec![];
    for mask in 1usize..1 << freight.len() {
        let members: Vec<_> = freight
            .iter()
            .enumerate()
            .filter(|(i, _)| mask & (1 << i) != 0)
            .map(|(_, &route)| route)
            .collect();
        let count_required = members
            .iter()
            .filter(|route| trains[route.train]["fleet"]["freight"] == "required")
            .count();
        if count_required > 0
            && (count_required != required.len()
                || members.len() != count_required + usize::from(freight.len() > required.len()))
        {
            continue;
        }
        let Some((a, b)) = oracle_chain(&members) else {
            continue;
        };
        let coordinate =
            |stop: usize| &fleet["coordinates"][stops[stop]["hex"].as_u64().unwrap() as usize];
        let dq = coordinate(a)["q"].as_i64().unwrap() - coordinate(b)["q"].as_i64().unwrap();
        let dr = coordinate(a)["r"].as_i64().unwrap() - coordinate(b)["r"].as_i64().unwrap();
        let length = (dq.abs().max(dr.abs()).max((dq + dr).abs()) - 1).max(0);
        let rate = fleet["bonus_per_hex"]
            .as_i64()
            .unwrap()
            .max(fleet["end_rates"][a].as_i64().unwrap())
            .max(fleet["end_rates"][b].as_i64().unwrap());
        let owner = |stop| {
            members
                .iter()
                .find(|route| route.stops[0] == stop || *route.stops.last().unwrap() == stop)
                .unwrap()
                .train
        };
        sets.push((mask, vec![(a, owner(a)), (b, owner(b))], length * rate));
    }
    fn groups(
        p: &Value,
        chosen: &[OracleRoute],
        sets: &[(usize, Vec<(usize, usize)>, i64)],
        remaining: usize,
        ends: &mut Vec<(usize, usize)>,
        bonuses: &mut Vec<i64>,
    ) -> Option<i64> {
        if remaining == 0 {
            // Each chain put its two ends in `ends`; chains between the same two payment groups
            // pay the best of their bonuses once when stops pay once.
            let mut between = std::collections::HashMap::new();
            for (chain, &amount) in bonuses.iter().enumerate() {
                let group = |end: usize| {
                    p["fleet"]["payment_groups"][ends[2 * chain + end].0]
                        .as_u64()
                        .unwrap()
                };
                let places = (group(0).min(group(1)), group(0).max(group(1)));
                let key = if p["fleet"]["pay_once"] == true {
                    (places, 0)
                } else {
                    (places, chain + 1)
                };
                between
                    .entry(key)
                    .and_modify(|value: &mut i64| *value = (*value).max(amount))
                    .or_insert(amount);
            }
            return Some(oracle_payments(p, chosen, ends) + between.values().sum::<i64>());
        }
        let first = 1 << remaining.trailing_zeros();
        let mut best = None;
        for (mask, payments, amount) in sets {
            if mask & remaining != *mask || mask & first == 0 {
                continue;
            }
            ends.extend(payments);
            bonuses.push(*amount);
            if let Some(value) = groups(p, chosen, sets, remaining ^ mask, ends, bonuses) {
                best = Some(best.unwrap_or(0).max(value));
            }
            bonuses.pop();
            ends.truncate(ends.len() - payments.len());
        }
        best
    }
    let mut subsidies = std::collections::HashMap::new();
    for route in chosen {
        let amount = trains[route.train]["fleet"]["hex_subsidy"]
            .as_i64()
            .unwrap();
        for hex in route
            .stops
            .iter()
            .map(|&stop| stops[stop]["hex"].as_u64().unwrap())
            .chain(
                route
                    .edges
                    .iter()
                    .map(|&edge| p["arcs"][edge * 2]["hex"].as_u64().unwrap()),
            )
        {
            subsidies
                .entry(hex)
                .and_modify(|value: &mut i64| *value = (*value).max(amount))
                .or_insert(amount);
        }
    }
    groups(
        p,
        chosen,
        &sets,
        (1 << freight.len()) - 1,
        &mut vec![],
        &mut vec![],
    )
    .map(|value| {
        value
            + subsidies.values().sum::<i64>()
            + chosen.iter().map(|route| route.subsidy).sum::<i64>()
    })
}

fn oracle_payments(p: &Value, chosen: &[OracleRoute], ends: &[(usize, usize)]) -> i64 {
    let mut alternatives = vec![];
    for route in chosen {
        let train = &p["trains"][route.train];
        let policy = &train["fleet"];
        if !policy["freight"].is_null() {
            continue;
        }
        let mut choices = vec![];
        for bits in 0u64..1 << route.called.len() {
            let selected: Vec<_> = route
                .called
                .iter()
                .enumerate()
                .filter(|(i, _)| bits & (1 << i) != 0)
                .map(|(_, &stop)| stop)
                .collect();
            if selected.iter().any(|&stop| policy["paying"][stop] != true) {
                continue;
            }
            if route.called.iter().any(|&stop| {
                policy["paying"][stop] == true
                    && policy["limited"][stop] != true
                    && !selected.contains(&stop)
            }) {
                continue;
            }
            let count = selected
                .iter()
                .filter(|&&stop| policy["limited"][stop] == true)
                .count();
            let payable = route
                .called
                .iter()
                .filter(|&&stop| policy["paying"][stop] == true && policy["limited"][stop] == true)
                .count();
            let limit = policy["paying_limit"]
                .as_u64()
                .map_or(payable, |n| (n as usize).min(payable));
            if count != limit {
                continue;
            }
            if policy["paying_limit"]
                .as_u64()
                .is_some_and(|limit| count > limit as usize)
            {
                continue;
            }
            choices.push(
                selected
                    .into_iter()
                    .map(|stop| (stop, route.train))
                    .collect::<Vec<_>>(),
            );
        }
        alternatives.push(choices);
    }
    fn product(
        p: &Value,
        lists: &[Vec<Vec<(usize, usize)>>],
        paid: &mut Vec<(usize, usize)>,
    ) -> i64 {
        if lists.is_empty() {
            let mut values = std::collections::HashMap::new();
            for &(stop, train) in paid.iter() {
                let group = p["fleet"]["payment_groups"][stop].as_u64().unwrap();
                let key = (
                    group,
                    if p["fleet"]["pay_once"] == true {
                        0
                    } else {
                        train
                    },
                );
                let amount = p["trains"][train]["revenues"][stop].as_i64().unwrap();
                values
                    .entry(key)
                    .and_modify(|value: &mut i64| *value = (*value).max(amount))
                    .or_insert(amount);
            }
            return values.values().sum();
        }
        let mut best = 0;
        for choice in &lists[0] {
            paid.extend(choice);
            best = best.max(product(p, &lists[1..], paid));
            paid.truncate(paid.len() - choice.len());
        }
        best
    }
    product(p, &alternatives, &mut ends.to_vec())
}

fn assert_fleet_oracle(p: &Value, edges: &[(usize, usize)]) {
    let result = solve(p);
    assert_eq!(
        result["revenue"].as_i64().unwrap() + result["subsidy"].as_i64().unwrap(),
        oracle_fleet(p, edges),
        "{p}"
    );
}

#[test]
fn fleet_policies_cover_shared_track_payment_groups_skip_choices_and_subsidies() {
    let edges = [(0, 1), (1, 2), (1, 3)];
    let mut p = fleet_graph(4, &edges, &[3, 3]);
    p["fleet"]["payment_groups"] = json!([0, 1, 2, 2]);
    p["trains"][0]["fleet"]["limited"] = json!([true, true, true, true]);
    p["trains"][0]["fleet"]["paying_limit"] = json!(1);
    p["trains"][0]["fleet"]["hex_subsidy"] = json!(10);
    p["trains"][1]["allowed_stops"] = json!([true, true, false, true]);
    for shared in [true, false] {
        p["fleet"]["shared_track"] = json!(shared);
        for once in [true, false] {
            p["fleet"]["pay_once"] = json!(once);
            assert_fleet_oracle(&p, &edges);
        }
    }
}

#[test]
fn fleet_root_and_city_connections_keep_legal_partial_fleets_in_sparse_networks() {
    let edges = [(0, 1), (2, 3), (3, 4), (1, 2)];
    for n in [6, 8, 10] {
        let mut p = fleet_graph(5, &edges, &vec![2; n]);
        for (i, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            train["allowed_stops"] = json!(
                (0..5)
                    .map(|stop| if i % 3 == 0 {
                        stop <= 1
                    } else {
                        stop == 2 || stop == 3
                    })
                    .collect::<Vec<_>>()
            );
        }
        assert_eq!(solve(&p)["revenue"], 30);
        assert_fleet_oracle(&p, &edges);
    }
}

#[test]
fn freight_required_chains_optional_anchors_and_groupings_match_an_independent_oracle() {
    let edges = [(0, 1), (1, 2), (2, 3), (0, 2)];
    for kinds in [
        ["required", "required", "optional"],
        ["optional", "optional", "optional"],
        ["required", "required", "required"],
    ] {
        let mut p = fleet_graph(4, &edges, &[2, 2, 2]);
        for (i, kind) in kinds.iter().enumerate() {
            p["trains"][i]["fleet"]["freight"] = json!(kind);
        }
        p["fleet"]["end_rates"][3] = json!(30);
        assert_fleet_oracle(&p, &edges);
    }
}

#[test]
fn native_fleets_agree_with_an_unpruned_oracle_on_generated_graphs() {
    let mut seed = 8743u64;
    let mut random = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        seed >> 32
    };
    for case in 0..160 {
        let mut edges = vec![];
        for a in 0..4 {
            for b in a + 1..4 {
                if random() % 3 == 0 {
                    edges.push((a, b));
                }
            }
        }
        let mut p = fleet_graph(
            4,
            &edges,
            &[
                2 + (random() % 2) as u32,
                2 + (random() % 2) as u32,
                2 + (random() % 2) as u32,
            ],
        );
        p["fleet"]["shared_track"] = json!(case % 3 != 0);
        for (id, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            train["revenues"] = json!((0..4).map(|_| 10 + (random() % 5) * 10).collect::<Vec<_>>());
            train["allowed_stops"] = json!((0..4).map(|_| random() % 6 != 0).collect::<Vec<_>>());
            if (case % 4 == 0 || case % 4 == 1) && id < 2 {
                train["fleet"]["freight"] = json!(if case % 4 == 0 && id == 0 {
                    "required"
                } else {
                    "optional"
                });
            } else {
                train["fleet"]["limited"] = json!(vec![true; 4]);
                train["fleet"]["paying_limit"] = json!(1 + random() % 2);
                train["fleet"]["hex_subsidy"] = json!(random() % 2 * 10);
            }
        }
        assert_fleet_oracle(&p, &edges);
    }
}

/// The oracle is slow on fleets this size, so only a few run by default; `FLEET_CASES` runs more.
#[test]
fn larger_generated_fleets_with_chains_and_shared_stops_match_the_oracle() {
    let cases: u64 = std::env::var("FLEET_CASES")
        .ok()
        .and_then(|cases| cases.parse().ok())
        .unwrap_or(12);
    let mut seed = 5119u64;
    let mut random = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        seed >> 32
    };
    for case in 0..cases {
        let nodes = 5 + (case % 2) as usize;
        let mut edges = vec![];
        for a in 0..nodes {
            for b in a + 1..nodes {
                if random() % 5 < 2 {
                    edges.push((a, b));
                }
            }
        }
        let trains = if nodes == 5 {
            4 + random() % 2
        } else {
            3 + random() % 2
        };
        let distances: Vec<_> = (0..trains).map(|_| 2 + (random() % 2) as u32).collect();
        let mut p = fleet_graph(nodes, &edges, &distances);
        p["fleet"]["shared_track"] = json!(random() % 4 != 0);
        p["fleet"]["pay_once"] = json!(random() % 4 != 0);
        p["fleet"]["bonus_per_hex"] = json!(10 + random() % 3 * 10);
        p["fleet"]["end_rates"] = json!((0..nodes).map(|_| random() % 4 * 10).collect::<Vec<_>>());
        p["fleet"]["payment_groups"] = json!(
            (0..nodes)
                .map(|stop| if random() % 5 == 0 { 0 } else { stop })
                .collect::<Vec<_>>()
        );
        if random() % 4 == 0 {
            p["fleet"]["connectivity"] = json!(null);
        } else {
            p["fleet"]["connectivity"]["stops"] =
                json!((0..nodes).map(|_| random() % 4 != 0).collect::<Vec<_>>());
            // The home station is always one of the stops that connect runs.
            if random() % 3 == 0 {
                p["fleet"]["connectivity"]["root"] = json!(null);
            } else {
                p["fleet"]["connectivity"]["stops"][0] = json!(true);
            }
        }
        for stop in p["stops"].as_array_mut().unwrap() {
            stop["token"] = json!(random() % 3 != 0);
        }
        p["stops"][0]["token"] = json!(true);
        let freights = random() % 4;
        for (id, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            train["revenues"] = json!(
                (0..nodes)
                    .map(|_| 10 + (random() % 5) * 10)
                    .collect::<Vec<_>>()
            );
            train["allowed_stops"] =
                json!((0..nodes).map(|_| random() % 8 != 0).collect::<Vec<_>>());
            if (id as u64) < freights {
                train["fleet"]["freight"] = json!(if random() % 3 == 0 {
                    "required"
                } else {
                    "optional"
                });
            } else {
                train["fleet"]["limited"] =
                    json!((0..nodes).map(|_| random() % 2 == 0).collect::<Vec<_>>());
                train["fleet"]["paying_limit"] = if random() % 2 == 0 {
                    json!(null)
                } else {
                    json!(1 + random() % 2)
                };
                train["fleet"]["paying"] =
                    json!((0..nodes).map(|_| random() % 6 != 0).collect::<Vec<_>>());
            }
            train["fleet"]["hex_subsidy"] = json!(random() % 2 * 10);
        }
        assert_fleet_oracle(&p, &edges);
    }
}

#[test]
fn connected_six_to_ten_train_fleets_match_the_product_oracle() {
    let edges = [(0, 1), (0, 2)];
    for trains in [6, 8, 10] {
        let mut p = fleet_graph(3, &edges, &vec![2; trains]);
        for (index, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            if index % 3 == 0 {
                train["fleet"]["limited"] = json!([true, true, true]);
                train["fleet"]["paying_limit"] = json!(1);
            }
            train["fleet"]["hex_subsidy"] = json!(10);
        }
        assert_fleet_oracle(&p, &edges);
    }
}

#[test]
fn freight_measures_offboard_ends_from_the_adjacent_hex_and_uses_the_end_rate() {
    let mut p = fleet_graph(3, &[(0, 1), (1, 2)], &[3]);
    p["fleet"]["connectivity"]["root"] = json!(1);
    p["fleet"]["connectivity"]["stops"] = json!([false, true, true]);
    p["fleet"]["offboard_distance"] = json!(true);
    p["fleet"]["coordinates"][0]["q"] = json!(-7);
    p["stops"][0]["city"] = json!(false);
    p["stops"][0]["blocked"] = json!(true);
    p["stops"][0]["token"] = json!(false);
    p["arcs"][0]["hex"] = json!(1);
    p["arcs"][1]["hex"] = json!(1);
    p["trains"][0]["fleet"]["freight"] = json!("required");
    assert_eq!(solve(&p)["revenue"], 60);
    p["fleet"]["end_rates"][0] = json!(30);
    assert_eq!(solve(&p)["revenue"], 70);
}

#[test]
fn freights_between_the_same_two_places_pay_the_distance_once() {
    let edges = [(0, 1)];
    let mut p = fleet_graph(2, &edges, &[2, 2]);
    p["fleet"]["coordinates"][1]["q"] = json!(2);
    for train in p["trains"].as_array_mut().unwrap() {
        train["fleet"]["freight"] = json!("optional");
    }
    assert_eq!(solve(&p)["revenue"], 50);
    assert_fleet_oracle(&p, &edges);
    p["fleet"]["pay_once"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 100);
    assert_fleet_oracle(&p, &edges);
}

#[test]
fn identical_trains_can_repeat_a_route_to_pay_different_stops() {
    let edges = [(0, 1), (1, 2)];
    let mut p = fleet_graph(3, &edges, &[3, 3]);
    p["stops"][1]["endpoint"] = json!(false);
    for train in p["trains"].as_array_mut().unwrap() {
        train["fleet"]["limited"] = json!([true, true, true]);
        train["fleet"]["paying_limit"] = json!(2);
    }
    assert_eq!(solve(&p)["revenue"], 60);
    assert_fleet_oracle(&p, &edges);
    p["fleet"]["pay_once"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 100);
    assert_fleet_oracle(&p, &edges);
    for train in p["trains"].as_array_mut().unwrap() {
        train["fleet"]["paying_limit"] = Value::Null;
    }
    assert_eq!(solve(&p)["revenue"], 120);
    assert_fleet_oracle(&p, &edges);
}

#[test]
fn freight_anchor_is_chosen_for_value_and_required_loops_cannot_run() {
    let edges = [(0, 1), (1, 2), (2, 3)];
    let mut p = fleet_graph(4, &edges, &[2, 2, 2]);
    p["fleet"]["connectivity"]["root"] = json!(1);
    p["fleet"]["end_rates"][0] = json!(30);
    for (index, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
        train["fleet"]["freight"] = json!(if index == 0 { "required" } else { "optional" });
        train["allowed_stops"] = json!(match index {
            0 => vec![false, true, true, false],
            1 => vec![false, false, true, true],
            _ => vec![true, true, false, false],
        });
    }
    assert_fleet_oracle(&p, &edges);
    let edges = [(0, 1), (1, 2), (0, 2)];
    let mut p = fleet_graph(3, &edges, &[2, 2, 2]);
    for train in p["trains"].as_array_mut().unwrap() {
        train["fleet"]["freight"] = json!("required");
    }
    let result = solve(&p);
    assert!(result["routes"].as_array().unwrap().len() < 3);
    assert_fleet_oracle(&p, &edges);
}

#[test]
fn fleet_run_shapes_and_payable_kinds_are_independent_of_distance() {
    let edges = [(0, 1), (1, 2)];
    let mut p = fleet_graph(3, &edges, &[3]);
    p["stops"][1]["city"] = json!(false);
    p["stops"][1]["town"] = json!(true);
    p["stops"][1]["endpoint"] = json!(false);
    p["trains"][0]["fleet"]["paying"] = json!([true, false, true]);
    assert_eq!(solve(&p)["revenue"], 40);
    p["fleet"]["minimum_cities"] = json!(3);
    assert_eq!(solve(&p)["revenue"], 0);
}

#[test]
fn fleet_memory_cuts_and_timeouts_never_claim_an_exhaustive_search() {
    let edges: Vec<_> = (0..7)
        .flat_map(|a| (a + 1..7).map(move |b| (a, b)))
        .collect();
    let mut p = fleet_graph(7, &edges, &[4, 4, 3]);
    let full = solve(&p);
    p["memory_budget_bytes"] = json!(16384);
    let limited: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert!(limited.get("error").is_none(), "{limited}");
    assert_eq!(limited["exhaustive"], false);
    assert_eq!(limited["memory_limited"], true);
    assert!(limited["revenue"].as_i64() <= full["revenue"].as_i64());
    p["memory_budget_bytes"] = json!(40 * 1024 * 1024);
    p["budget_ms"] = json!(0.001);
    let timed: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert_eq!(timed["exhaustive"], false);
    assert_eq!(timed["memory_limited"], false);
}

// A line from stop 0 to stop 1 over three paths of the given gauges, the middle one between two
// hex sides, for a hex train weighing standard 1 and narrow 2.
fn gauged_line(gauges: [&str; 3], distance: u32) -> Value {
    let mut p = graph(2, &[(0, 1), (0, 1), (0, 1)], &[distance]);
    p["trains"][0]["crossing_costs"] = json!([1, 2, 1]);
    p["trains"][0]["visit_costs"] = json!([0, 0]);
    let arc = |from: Value, to: Value, next: Value, path: usize, crossings: u32| {
        json!({"from": from, "to": to, "next": next, "junctions": [], "resources": [path],
            "path": path, "hex": path, "crossings": crossings, "terminal": false,
            "gauge": gauges[path]})
    };
    p["arcs"] = json!([
        arc(json!(0), Value::Null, json!([2]), 0, 1),
        arc(Value::Null, json!(0), json!([]), 0, 0),
        arc(Value::Null, Value::Null, json!([4]), 1, 1),
        arc(Value::Null, Value::Null, json!([1]), 1, 1),
        arc(Value::Null, json!(1), json!([]), 2, 0),
        arc(json!(1), Value::Null, json!([3]), 2, 1),
    ]);
    p
}

#[test]
fn routes_change_gauge_only_at_stops_and_weigh_each_stretch() {
    assert_eq!(
        solve(&gauged_line(["narrow", "dual", "standard"], 10))["revenue"],
        0
    );
    assert_eq!(
        solve(&gauged_line(["narrow", "dual", "narrow"], 4))["revenue"],
        30
    );
    assert_eq!(
        solve(&gauged_line(["narrow", "dual", "narrow"], 3))["revenue"],
        0
    );
    assert_eq!(
        solve(&gauged_line(["standard", "dual", "standard"], 2))["revenue"],
        30
    );
    assert_eq!(
        solve(&gauged_line(["dual", "dual", "dual"], 2))["revenue"],
        30
    );
    let mut reverse = gauged_line(["dual", "dual", "dual"], 2);
    reverse["trains"][0]["crossing_costs"] = json!([2, 1, 1]);
    assert_eq!(solve(&reverse)["revenue"], 30);
}

#[test]
fn routes_visit_the_cities_and_towns_a_problem_asks() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][2]["city"] = json!(false);
    p["minimum_cities_and_towns"] = json!(3);
    assert_eq!(solve(&p)["revenue"], 0);
    p["stops"][2]["town"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 60);
}

/// 1860's rules on a fleet graph: towns the trains may pass, halts that pay a subsidy and end no
/// route, cities tokened out that one route of the run may pass through, and hexes a route may
/// not enter again.
fn passing_fleet(
    random: &mut impl FnMut() -> u64,
    nodes: usize,
    trains: usize,
) -> (Value, Vec<(usize, usize)>) {
    let mut edges = vec![];
    for a in 0..nodes {
        for b in a + 1..nodes {
            if random() % 5 < 2 {
                edges.push((a, b));
            }
        }
    }
    let distances: Vec<_> = (0..trains).map(|_| 2 + (random() % 2) as u32).collect();
    let mut p = fleet_graph(nodes, &edges, &distances);
    p["fleet"]["shared_track"] = json!(random().is_multiple_of(4));
    p["fleet"]["pay_once"] = json!(false);
    p["fleet"]["minimum_cities"] = json!(0);
    p["no_reentry"] = json!(!random().is_multiple_of(3));
    p["blocked_passes"] = json!(random() % 3);
    let mut halts = vec![false; nodes];
    let mut towns = vec![false; nodes];
    for (id, stop) in p["stops"].as_array_mut().unwrap().iter_mut().enumerate() {
        let kind = if id == 0 { 0 } else { random() % 6 };
        towns[id] = kind >= 3;
        halts[id] = kind == 5;
        stop["city"] = json!(kind < 3 && kind != 2 || id == 0);
        stop["town"] = json!(towns[id]);
        stop["blocked"] = json!(kind == 1 || kind == 2);
        stop["token"] = json!(id == 0 || kind == 0 && random().is_multiple_of(2));
        stop["endpoint"] = json!(!halts[id]);
    }
    // Track between two stops lies in one of their hexes or in a hex of its own.
    for (edge, &(a, b)) in edges.iter().enumerate() {
        let hex = match random() % 3 {
            0 => a,
            1 => b,
            _ => nodes + edge,
        };
        for arc in [2 * edge, 2 * edge + 1] {
            p["arcs"][arc]["hex"] = json!(hex);
        }
    }
    let hexes = nodes + edges.len();
    p["hex_bonuses"] = json!(vec![0; hexes]);
    p["fleet"]["coordinates"] = json!(
        (0..hexes)
            .map(|q| json!({"q": q, "r": 0}))
            .collect::<Vec<_>>()
    );
    for train in p["trains"].as_array_mut().unwrap() {
        let leased = random().is_multiple_of(4);
        train["revenues"] = json!(
            (0..nodes)
                .map(|id| if halts[id] && !leased {
                    0
                } else {
                    10 + (random() % 4) * 10
                })
                .collect::<Vec<_>>()
        );
        train["optional"] = json!(towns);
        train["subsidies"] = json!(
            (0..nodes)
                .map(|id| if halts[id] && !leased { 10 } else { 0 })
                .collect::<Vec<_>>()
        );
    }
    (p, edges)
}

#[test]
fn passed_stops_halts_blocked_passes_and_hex_reentry_match_an_independent_oracle() {
    let mut seed = 1860u64;
    let mut random = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        seed >> 32
    };
    let mut subsidized = 0;
    let mut passing = 0;
    for case in 0..240 {
        let nodes = 5 + case % 2;
        let (p, edges) = passing_fleet(&mut random, nodes, 2 + case % 2);
        let result = solve(&p);
        if result["subsidy"].as_i64().unwrap() > 0 {
            subsidized += 1;
        }
        if p["blocked_passes"].as_u64().unwrap() > 0
            && p["stops"]
                .as_array()
                .unwrap()
                .iter()
                .any(|stop| stop["blocked"] == true)
        {
            passing += 1;
        }
        let result = solve(&p);
        assert_eq!(
            result["revenue"].as_i64().unwrap() + result["subsidy"].as_i64().unwrap(),
            oracle_fleet(&p, &edges),
            "case {case}: {result} {p}"
        );
    }
    assert!(subsidized > 5, "{subsidized}");
    assert!(passing > 20, "{passing}");
}

#[test]
fn a_train_calls_at_the_optional_stops_worth_most_while_its_distance_allows() {
    // 0 - 1 - 2 - 3 - 4: the towns between the ends pay 20, 50 and 30.
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[3]);
    p["trains"][0]["revenues"] = json!([10, 20, 50, 30, 40]);
    p["trains"][0]["optional"] = json!([false, true, true, true, false]);
    for id in 1..4 {
        p["stops"][id]["town"] = json!(true);
        p["stops"][id]["city"] = json!(false);
    }
    assert_eq!(solve(&p)["revenue"], 100);
    p["trains"][0]["distance"] = json!(4);
    assert_eq!(solve(&p)["revenue"], 130);
    // Its required stops alone may not exceed its distance: 0 - 1 - 2 beats the whole line.
    p["trains"][0]["optional"] = json!([false, false, true, true, false]);
    p["trains"][0]["distance"] = json!(3);
    assert_eq!(solve(&p)["revenue"], 80);
    p["trains"][0]["distance"] = json!(2);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn a_halt_ends_no_route_and_pays_its_subsidy_only_when_called_at() {
    let edges = [(0, 1), (1, 2)];
    let mut p = fleet_graph(3, &edges, &[2]);
    p["fleet"]["pay_once"] = json!(false);
    p["stops"][1]["endpoint"] = json!(false);
    p["stops"][1]["town"] = json!(true);
    p["stops"][1]["city"] = json!(false);
    p["trains"][0]["optional"] = json!([false, true, false]);
    p["trains"][0]["revenues"] = json!([10, 0, 30]);
    p["trains"][0]["subsidies"] = json!([0, 10, 0]);
    let result = solve(&p);
    assert_eq!(
        (result["revenue"].clone(), result["subsidy"].clone()),
        (json!(40), json!(0))
    );
    p["trains"][0]["distance"] = json!(3);
    let result = solve(&p);
    assert_eq!(
        (result["revenue"].clone(), result["subsidy"].clone()),
        (json!(40), json!(10))
    );
    assert_fleet_oracle(&p, &edges);
}

#[test]
fn one_route_of_the_run_passes_one_blocked_city() {
    // Two trains each want to run through the blocked city 2: 0-2-1 and 3-2-4.
    let edges = [(0, 2), (2, 1), (3, 2), (2, 4)];
    let mut p = fleet_graph(5, &edges, &[3, 3]);
    p["fleet"]["pay_once"] = json!(false);
    p["fleet"]["shared_track"] = json!(false);
    p["stops"][2]["blocked"] = json!(true);
    p["stops"][2]["token"] = json!(false);
    p["blocked_passes"] = json!(0);
    assert_fleet_oracle(&p, &edges);
    let alone = solve(&p)["revenue"].as_i64().unwrap();
    p["blocked_passes"] = json!(1);
    assert_fleet_oracle(&p, &edges);
    let once = solve(&p)["revenue"].as_i64().unwrap();
    assert!(once > alone);
    p["blocked_passes"] = json!(2);
    assert_fleet_oracle(&p, &edges);
    assert!(solve(&p)["revenue"].as_i64().unwrap() > once);
    // An offboard is never passed.
    p["stops"][2]["city"] = json!(false);
    assert_eq!(solve(&p)["revenue"].as_i64().unwrap(), alone);
}

#[test]
fn a_route_does_not_enter_a_hex_it_has_left() {
    // Stops 0 and 2 share a hex; the track to 1 lies in its hex and the track on to 2 in theirs.
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["hex_bonuses"] = json!([0, 0]);
    for (id, hex) in [0, 1, 0].into_iter().enumerate() {
        p["stops"][id]["hex"] = json!(hex);
        p["stops"][id]["token"] = json!(true);
    }
    for (arc, hex) in [1, 1, 0, 0].into_iter().enumerate() {
        p["arcs"][arc]["hex"] = json!(hex);
    }
    assert_eq!(solve(&p)["revenue"], 60);
    p["no_reentry"] = json!(true);
    // 0 → 1 → 2 leaves hex 0 for hex 1 and runs back into hex 0.
    assert_eq!(solve(&p)["revenue"], 50);
    // Track that stays in hex 1 to reach a stop of hex 0 is no reentry until it leaves.
    p["arcs"][2]["hex"] = json!(1);
    p["arcs"][3]["hex"] = json!(1);
    assert_eq!(solve(&p)["revenue"], 60);
}
