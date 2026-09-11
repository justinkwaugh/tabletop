use std::io::{Read, Write};
fn main() {
    let mut input = Vec::new();
    std::io::stdin().read_to_end(&mut input).unwrap();
    std::io::stdout()
        .write_all(&rail_route_solver::solve_json(&input))
        .unwrap();
}
