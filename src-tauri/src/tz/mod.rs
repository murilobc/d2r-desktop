// Terror Zone pure logic module.
// No Tauri dependencies — all functions are pure and fully testable.

pub mod commands;

use std::collections::HashMap;

/// The 65 Terror Zone areas in D2R v3.2 rotation order.
pub const TERROR_ZONES: [&str; 65] = [
    "Blood Moor and Den of Evil",
    "Cold Plains and The Cave",
    "Stony Field",
    "Dark Wood and Black Marsh",
    "Tamoe Highland and Pit",
    "Outer Cloister and Barracks",
    "Jail",
    "Inner Cloister and Cathedral",
    "Catacombs",
    "Lut Gholein Sewers",
    "Rocky Waste and Stony Tomb",
    "Dry Hills and Halls of the Dead",
    "Far Oasis",
    "Lost City, Valley of Snakes, and Claw Viper Temple",
    "Arcane Sanctuary",
    "Canyon of the Magi",
    "Tal Rasha's Tombs",
    "Spider Forest and Spider Cavern",
    "Flayer Jungle and Swampy Pit",
    "Lower Kurast",
    "Kurast Bazaar, Upper Kurast, and Kurast Causeway",
    "Travincal",
    "Durance of Hate",
    "Outer Steppes and Plains of Despair",
    "City of the Damned",
    "River of Flame",
    "Chaos Sanctuary",
    "Bloody Foothills and Frigid Highlands",
    "Glacial Trail and Drifter Cavern",
    "Crystalline Passage and Frozen River",
    "Frozen Tundra and Ancient's Way",
    "Nihlathak's Temple, Halls of Anguish, and Halls of Pain",
    "Halls of Vaught",
    "Abaddon",
    "Pit of Acheron",
    "Infernal Pit",
    "The Worldstone Keep and Throne of Destruction",
    "Ancient Tunnels",
    "Outer Cloister",
    "Cathedral",
    "Tristram",
    "The Hole",
    "The Pit",
    "Mausoleum",
    "Crypt",
    "Forgotten Tower",
    "Sewers Act II",
    "The Maggot Lair",
    "The Ancient Tunnels",
    "Tal Rasha's Chamber",
    "Spider Cavern",
    "Swampy Pit",
    "Kurast Sewers",
    "Travincal Council",
    "Durance of Hate Level 1",
    "Chaos Sanctuary Level 1",
    "Frigid Highlands",
    "Arreat Plateau",
    "Crystalline Passage",
    "Glacial Trail",
    "Ancient's Way",
    "Worldstone Keep Level 1",
    "Worldstone Keep Level 2",
    "Throne of Destruction",
    "Worldstone Chamber",
];

/// Returns the TERROR_ZONES rotation index active at the given UTC Unix second.
/// Uses div_euclid to handle negative timestamps correctly.
pub fn rotation_index(unix_secs: i64) -> usize {
    let hour = unix_secs.div_euclid(3600);
    // div_euclid always returns non-negative when divisor is positive,
    // so we can safely cast and apply modulo
    hour.rem_euclid(TERROR_ZONES.len() as i64) as usize
}

/// Returns the zone name active at the given UTC Unix second.
pub fn zone_at(unix_secs: i64) -> &'static str {
    TERROR_ZONES[rotation_index(unix_secs)]
}

/// Returns the UTC Unix second at which the next hourly boundary after unix_secs occurs.
pub fn next_boundary(unix_secs: i64) -> i64 {
    (unix_secs.div_euclid(3600) + 1) * 3600
}

/// Returns `count` upcoming zone names and their UTC start times,
/// starting from the hour immediately following unix_secs.
pub fn upcoming_zones(unix_secs: i64, count: usize) -> Vec<(i64, &'static str)> {
    let base = (unix_secs.div_euclid(3600) + 1) * 3600;
    (0..count as i64)
        .map(|i| {
            let t = base + i * 3600;
            (t, zone_at(t))
        })
        .collect()
}

/// Returns the tier for a given zone name (S/A/B/C).
pub fn tier_for_zone(zone: &str) -> &'static str {
    // Tier assignments based on D2R v3.2 meta
    static TIERS: std::sync::OnceLock<HashMap<&'static str, &'static str>> =
        std::sync::OnceLock::new();
    let map = TIERS.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("Tamoe Highland and Pit", "S");
        m.insert("Chaos Sanctuary", "S");
        m.insert("Lower Kurast", "S");
        m.insert("Travincal", "A");
        m.insert("Arcane Sanctuary", "A");
        m.insert("Ancient Tunnels", "A");
        m.insert("Nihlathak's Temple, Halls of Anguish, and Halls of Pain", "A");
        m.insert("Halls of Vaught", "A");
        m.insert("Kurast Bazaar, Upper Kurast, and Kurast Causeway", "A");
        m.insert("Durance of Hate", "B");
        m.insert("Canyon of the Magi", "B");
        m.insert("Tal Rasha's Tombs", "B");
        m.insert("The Worldstone Keep and Throne of Destruction", "S");
        m.insert("River of Flame", "B");
        m.insert("City of the Damned", "B");
        m
    });
    map.get(zone).copied().unwrap_or("C")
}

/// Rate limiter for testing the rate-limit invariant.
pub struct RateLimiter {
    pub last_fetch_secs: Option<i64>,
    pub cooldown_secs: i64,
}

impl RateLimiter {
    pub fn new(cooldown_secs: i64) -> Self {
        Self {
            last_fetch_secs: None,
            cooldown_secs,
        }
    }

    /// Returns true if a fetch should be dispatched at now_secs.
    pub fn should_fetch(&mut self, now_secs: i64) -> bool {
        match self.last_fetch_secs {
            None => {
                self.last_fetch_secs = Some(now_secs);
                true
            }
            Some(last) if now_secs - last >= self.cooldown_secs => {
                self.last_fetch_secs = Some(now_secs);
                true
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // Feature: terror-zone-api, Property 1: Zone membership
    proptest! {
        #[test]
        fn prop_zone_membership(t in any::<i64>()) {
            let name = zone_at(t);
            prop_assert!(TERROR_ZONES.contains(&name));
        }
    }

    // Feature: terror-zone-api, Property 2: Same-hour determinism
    proptest! {
        #[test]
        fn prop_same_hour_same_zone(t in any::<i64>(), offset in 0i64..3600) {
            let hour_start = t.div_euclid(3600) * 3600;
            let t2 = hour_start + offset;
            prop_assert_eq!(zone_at(t), zone_at(t2));
        }
    }

    // Feature: terror-zone-api, Property 3: Hourly boundary produces a zone change
    proptest! {
        #[test]
        fn prop_boundary_zone_changes(hour in -1_000_000_000i64..1_000_000_000) {
            let t = hour * 3600;
            prop_assert_ne!(zone_at(t), zone_at(t - 1));
        }
    }

    // Feature: terror-zone-api, Property 4: Rate limit enforcement
    proptest! {
        #[test]
        fn prop_rate_limit_enforcement(
            start in 0i64..1_000_000,
            gaps in proptest::collection::vec(1i64..200, 1..10)
        ) {
            // All gaps are < 200s, so total time is at most 10*200 = 2000s.
            // But the cooldown is 600s, so with 10 gaps of up to 200s each (max 2000s total),
            // the cooldown could expire. We only check the strict case where all cumulative
            // elapsed from last dispatch is < 600.
            let mut limiter = RateLimiter::new(600);
            let mut dispatched = 0usize;
            let mut t = start;
            if limiter.should_fetch(t) { dispatched += 1; }
            let mut last_dispatch = start;
            for gap in gaps {
                t += gap;
                let was_dispatched = limiter.should_fetch(t);
                if was_dispatched {
                    // Only count dispatches if they were within 600s of the last
                    // (should_fetch already enforces this, so just count)
                    dispatched += 1;
                    last_dispatch = t;
                }
                // The invariant: if t - last_dispatch < 600, should_fetch returns false
                if t - last_dispatch < 600 {
                    prop_assert!(!limiter.should_fetch(t));
                }
            }
            // We're just checking the invariant, not that dispatched == 1
        }
    }

    // Feature: terror-zone-api, Property 5: Upcoming zones strict monotonicity
    proptest! {
        #[test]
        fn prop_upcoming_monotonic(t in any::<i64>(), n in 2usize..8) {
            let zones = upcoming_zones(t, n);
            prop_assert_eq!(zones.len(), n);
            for i in 0..zones.len() - 1 {
                prop_assert_eq!(zones[i + 1].0 - zones[i].0, 3600);
            }
        }
    }
}
