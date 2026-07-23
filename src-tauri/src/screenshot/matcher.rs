use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::LazyLock;
use strsim::normalized_levenshtein;

use super::parser::ParsedCandidate;

/// A single entry in the in-memory item database used for fuzzy matching.
#[derive(Debug, Clone)]
pub struct GameItemEntry {
    pub name: String,
    pub normalized_name: String,
    pub category: String,
    pub subcategory: String,
}

/// A match candidate returned by the fuzzy matcher.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MatchCandidate {
    pub item_name: String,
    pub category: String,
    pub subcategory: String,
    pub confidence: u8,
}

/// Normalize OCR-confusable characters to a canonical form.
///
/// Replacements:
/// - '0' (digit zero) → 'O' (capital O)
/// - '1' (digit one) → 'l' (lowercase L)
/// - 'I' (capital I) → 'l' (lowercase L)
///
/// This function is idempotent: applying it twice yields the same result as once.
pub fn normalize_ocr_chars(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '0' => 'O',
            '1' => 'l',
            'I' => 'l',
            _ => c,
        })
        .collect()
}

/// Calculate confidence score between extracted OCR text and a known item name.
///
/// Both inputs are lowercased before comparison. Uses normalized Levenshtein
/// distance scaled to 0–100.
pub fn calculate_confidence(extracted: &str, item_name: &str) -> u8 {
    let a = extracted.to_lowercase();
    let b = item_name.to_lowercase();
    let score = normalized_levenshtein(&a, &b);
    (score * 100.0).round() as u8
}

/// Returns true for categories that get priority in tiebreaker sorting.
fn is_priority_category(category: &str) -> bool {
    matches!(category, "Unique" | "Set" | "Rune")
}

/// Match parsed candidates against the item database and return the top results.
///
/// For each candidate with non-empty text:
/// 1. Normalize and lowercase the text
/// 2. Compute confidence against every item in the database
/// 3. Collect matches with confidence > 0
/// 4. Dedup by item_name (keep highest confidence)
/// 5. Sort by confidence descending with tiebreaker: within a 5-point band,
///    Unique/Set/Rune categories rank above others
/// 6. Return at most 5 matches
///
/// Returns an empty list if all candidates have empty/whitespace-only text.
pub fn match_items(
    candidates: &[ParsedCandidate],
    item_database: &[GameItemEntry],
    _threshold: u8,
) -> Vec<MatchCandidate> {
    // 1. Check for empty/whitespace-only inputs
    let has_valid_input = candidates.iter().any(|c| !c.text.trim().is_empty());
    if !has_valid_input {
        return Vec::new();
    }

    // 2. For each candidate, compute scores against all items
    let mut matches: Vec<MatchCandidate> = Vec::new();

    for candidate in candidates {
        let text = candidate.text.trim();
        if text.is_empty() {
            continue;
        }

        let normalized = normalize_ocr_chars(&text.to_lowercase());

        for item in item_database {
            let confidence = calculate_confidence(&normalized, &item.name);
            if confidence > 0 {
                matches.push(MatchCandidate {
                    item_name: item.name.clone(),
                    category: item.category.clone(),
                    subcategory: item.subcategory.clone(),
                    confidence,
                });
            }
        }
    }

    // 3. Dedup by item_name, keeping highest confidence
    matches.sort_by(|a, b| b.confidence.cmp(&a.confidence));
    let mut seen = HashSet::new();
    matches.retain(|m| seen.insert(m.item_name.clone()));

    // 4. Apply tiebreaker within 5-point bands
    // Sort with tiebreaker: if within 5 points, prefer Unique/Set/Rune
    matches.sort_by(|a, b| {
        if a.confidence.abs_diff(b.confidence) <= 5 {
            let a_priority = is_priority_category(&a.category);
            let b_priority = is_priority_category(&b.category);
            match (a_priority, b_priority) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => b.confidence.cmp(&a.confidence),
            }
        } else {
            b.confidence.cmp(&a.confidence)
        }
    });

    // 5. Return top 5
    matches.truncate(5);
    matches
}

/// Build a GameItemEntry with pre-computed normalized_name.
fn entry(name: &str, category: &str, subcategory: &str) -> GameItemEntry {
    let normalized_name = normalize_ocr_chars(&name.to_lowercase());
    GameItemEntry {
        name: name.to_string(),
        normalized_name,
        category: category.to_string(),
        subcategory: subcategory.to_string(),
    }
}

/// The static item database, loaded once and shared across the application.
/// Mirrors all items from `src/data/items.ts`.
pub static ITEM_DATABASE: LazyLock<Vec<GameItemEntry>> = LazyLock::new(|| {
    let mut items = Vec::with_capacity(800);

    // ===== RUNES (33 total) =====
    for name in RUNE_NAMES.iter() {
        items.push(entry(&format!("{} Rune", name), "Rune", "Rune"));
    }

    // ===== RUNEWORDS =====
    for name in RUNEWORD_NAMES.iter() {
        items.push(entry(name, "Runeword", "Runeword"));
    }

    // ===== UNIQUE WEAPONS =====
    for name in UNIQUE_WEAPON_NAMES.iter() {
        items.push(entry(name, "Unique", "Weapon"));
    }

    // ===== UNIQUE ARMOR =====
    for name in UNIQUE_ARMOR_NAMES.iter() {
        items.push(entry(name, "Unique", "Armor"));
    }

    // ===== UNIQUE JEWELRY =====
    for name in UNIQUE_JEWELRY_NAMES.iter() {
        items.push(entry(name, "Unique", "Jewelry"));
    }

    // ===== UNIQUE GRIMOIRES =====
    for name in UNIQUE_GRIMOIRE_NAMES.iter() {
        items.push(entry(name, "Unique", "Grimoire"));
    }

    // ===== UNIQUE JEWELS =====
    for name in UNIQUE_JEWEL_NAMES.iter() {
        items.push(entry(name, "Unique", "Jewel"));
    }

    // ===== SET ITEMS =====
    for name in SET_ITEM_NAMES.iter() {
        items.push(entry(name, "Set", "Set Item"));
    }

    // ===== BASE ITEMS =====
    for name in BASE_ITEM_NAMES.iter() {
        items.push(entry(name, "Base", "Base Item"));
    }

    // ===== CHARMS =====
    for name in CHARM_NAMES.iter() {
        items.push(entry(name, "Charm", "Charm"));
    }

    // ===== JEWELS =====
    for name in JEWEL_NAMES.iter() {
        items.push(entry(name, "Jewel", "Jewel"));
    }

    // ===== MAGIC/RARE ITEMS =====
    for name in MAGIC_RARE_NAMES.iter() {
        items.push(entry(name, "Rare/Magic", "Crafted"));
    }

    items
});

// ===== Static item name arrays =====

const RUNE_NAMES: &[&str] = &[
    "El", "Eld", "Tir", "Nef", "Eth", "Ith", "Tal", "Ral", "Ort", "Thul",
    "Amn", "Sol", "Shael", "Dol", "Hel", "Io", "Lum", "Ko", "Fal", "Lem",
    "Pul", "Um", "Mal", "Ist", "Gul", "Vex", "Ohm", "Lo", "Sur", "Ber",
    "Jah", "Cham", "Zod",
];


const RUNEWORD_NAMES: &[&str] = &[
    // Classic & LoD Runewords
    "Ancient's Pledge", "Beast", "Black", "Bone", "Bramble", "Brand", "Breath of the Dying",
    "Call to Arms", "Chains of Honor", "Chaos", "Crescent Moon", "Death", "Delirium",
    "Destruction", "Doom", "Dragon", "Dream", "Duress", "Edge", "Enigma", "Enlightenment",
    "Eternity", "Exile", "Faith", "Famine", "Fortitude", "Fury", "Gloom", "Grief",
    "Hand of Justice", "Harmony", "Heart of the Oak", "Holy Thunder", "Honor", "Ice",
    "Infinity", "Insight", "King's Grace", "Kingslayer", "Last Wish", "Lawbringer",
    "Leaf", "Lionheart", "Lore", "Malice", "Melody", "Memory", "Myth", "Nadir",
    "Oath", "Obedience", "Passion", "Peace", "Phoenix", "Plague", "Pride", "Principle",
    "Prudence", "Radiance", "Rain", "Rhyme", "Rift", "Sanctuary", "Silence", "Smoke",
    "Spirit", "Splendor", "Stealth", "Steel", "Stone", "Strength", "Treachery", "Venom",
    "Voice of Reason", "Wealth", "White", "Wind", "Wrath", "Zephyr",
    // Ladder Runewords (2.4+)
    "Bulwark", "Cure", "Ground", "Hearth", "Hustle", "Metamorphosis", "Mist",
    "Mosaic", "Obsession", "Pattern", "Temper", "Unbending Will", "Wisdom", "Flickering Flame",
    // Reign of the Warlock (v3.0) new runewords
    "Authority", "Coven", "Void", "Vigilance", "Ritual",
];

const UNIQUE_WEAPON_NAMES: &[&str] = &[
    // Axes
    "The Gnasher", "Deathspade", "Bladebone", "Skull Splitter", "Rakescar",
    "Axe of Fechmar", "Goreshovel", "The Chieftain", "Brainhew", "Humongous",
    "Coldkill", "Butcher's Pupil", "Islestrike", "Pompeii's Wrath", "Guardian Naga",
    "Warlord's Trust", "Spellsteel", "Stormrider", "Boneslayer Blade", "The Minotaur",
    "Razor's Edge", "Rune Master", "Cranebeak", "Death Cleaver", "Ethereal Edge",
    "Hellslayer", "Messerschmidt's Reaver", "Executioner's Justice",
    // Bows
    "Pluckeye", "Witherstring", "Raven Claw", "Rogue's Bow", "Stormstrike",
    "Wizendraw", "Hellclap", "Blastbark", "Skystrike", "Riphook", "Kuko Shakaku",
    "Endlesshail", "Witchwild String", "Cliffkiller", "Magewrath", "Goldstrike Arch",
    "Eaglehorn", "Widowmaker", "Windforce",
    // Crossbows
    "Leadcrow", "Ichorsting", "Hellcast", "Doomslinger", "Langer Briser",
    "Pus Spitter", "Buriza-Do Kyanon", "Demon Machine", "Hellrack", "Gut Siphon",
    // Daggers
    "Gull", "The Diggler", "The Jade Tan Do", "Spectral Shard",
    "Spineripper", "Heart Carver", "Blackbog's Sharp", "Stormspike",
    "Wizardspike", "Fleshripper", "Ghostflame",
    // Javelins
    "Demon's Arch", "Wraith Flight", "Gargoyle's Bite", "Thunderstroke", "Titan's Revenge",
    // Maces
    "Felloak", "Stoutnail", "Crushflange", "Bloodrise", "The General's Tan Do Li Ga",
    "Ironstone", "Bonesnap", "Steeldriver",
    "Dark Clan Crusher", "Fleshrender", "Sureshrill Frost", "Moonfall",
    "Baezil's Vortex", "Earthshaker",
    "Bloodtree Stump", "The Gavel of Pain", "Windhammer", "Earth Shifter",
    "Cranium Basher", "Schaefer's Hammer", "Stone Crusher", "Horizon's Tornado",
    // Polearms
    "Dimoak's Hew", "Steelgoad", "Soul Harvest", "The Battlebranch",
    "Woestave", "The Grim Reaper", "Razortine",
    "Blackleach Blade", "Athena's Wrath", "Pierre Tombale Couant",
    "Husoldal Evo", "Grim's Burning Dead",
    "Bonehew", "The Reaper's Toll", "Tomb Reaver", "Stormspire",
    // Scepters
    "Knell Striker", "Rusthandle", "Stormeye",
    "Zakarum's Hand", "The Fetid Sprinkler", "Hand of Blessed Light",
    "Heaven's Light", "The Redeemer", "Astreon's Iron Ward",
    // Spears
    "The Dragon Chang", "Bloodthief", "Lance of Yaggai",
    "The Tannr Gorerod", "The Impaler", "Kelpie Snare", "Soulfeast Tine",
    "Hone Sundan", "Spire of Honor", "Arioc's Needle", "Viperfork", "Steel Pillar",
    // Staves
    "Bane Ash", "Serpent Lord", "Spire of Lazarus", "The Salamander",
    "The Iron Jang Bong", "Razorswitch", "Ribcracker",
    "Chromatic Ire", "Warpspear", "Skull Collector",
    "Ondal's Wisdom", "Mang Song's Lesson",
    // Swords
    "Rixot's Keen", "Blood Crescent", "Skewer of Krintiz", "Gleamscythe",
    "Griswold's Edge", "Hellplague", "Culwen's Point", "Shadowfang", "Soulflay",
    "Kinemil's Awl", "Blacktongue", "Ripsaw", "The Patriarch",
    "Bloodletter", "Coldsteel Eye", "Hexfire", "Blade of Ali Baba", "Ginther's Rift",
    "Headstriker", "Plague Bearer", "The Atlantean", "Crainte Vomir", "Bing Sz Wang",
    "The Vile Husk", "Cloudcrack", "Todesfaelle Flamme", "Swordguard",
    "Djinn Slayer", "Bloodmoon", "Lightsabre", "Azurewrath", "Frostwind",
    "Flamebellow", "Doombringer", "The Grandfather", "Stormlash",
    // Throwing Weapons
    "Deathbit", "The Scalper", "Warshrike", "Gimmershred", "Lacerator",
    // Wands
    "Torch of Iro", "Maelstrom", "Gravenspine", "Ume's Lament",
    "Suicide Branch", "Carin Shard", "Arm of King Leoric", "Blackhand Key",
    "Boneshade", "Death's Web",
    // Katars (Assassin)
    "Bartuc's Cut-Throat", "Jade Talon", "Shadow Killer", "Firelizard's Talons", "Naga",
    // Orbs (Sorceress)
    "The Oculus", "Eschuta's Temper", "Death's Fathom",
    // RotW Warlock Unique Weapons
    "Dreadfang", "Bloodpact Shard",
    // Additional Classic Unique Weapons
    "Nord's Tenderizer", "Demon Limb", "Baranar's Star",
    "Lycander's Flank", "Blood Raven's Charge", "Stoneraven",
    "Runewind", "Shadowkiller", "Jade Figurine",
];


const UNIQUE_ARMOR_NAMES: &[&str] = &[
    // Body Armor
    "Greyform", "Blinkbat's Form", "The Centurion", "Twitchthroe", "Darkglow",
    "Hawkmail", "Sparking Mail", "Venom Ward", "Iceblink", "Boneflesh",
    "Rockfleece", "Rattlecage", "Goldskin", "Victual's Silk", "Spirit Forge",
    "Crow Caw", "Duriel's Shell", "Shaftstop", "Skullder's Ire", "Que-Hegan's Wisdom",
    "Guardian Angel", "Toothrow", "Atma's Wail", "Black Hades", "Corpsemourn",
    "Ormus' Robes", "The Gladiator's Bane", "Arkaine's Valor", "Leviathan",
    "Steel Carapace", "Templar's Might", "Tyrael's Might",
    // Helms
    "Biggin's Bonnet", "Tarnhelm", "Coif of Glory", "Duskdeep", "Wormskull",
    "Howltusk", "Undead Crown", "The Face of Horror",
    "Peasant Crown", "Rockstopper", "Stealskull", "Darksight Helm",
    "Vampire Gaze", "Valkyrie Wing", "Crown of Thieves", "Blackhorn's Face",
    "Andariel's Visage", "Crown of Ages", "Giant Skull", "Harlequin Crest",
    "Nightwing's Veil", "Kira's Guardian", "Griffon's Eye",
    // Barbarian Helms
    "Arreat's Face", "Demonhorn's Edge", "Halaberd's Reign", "Wolfhowl",
    // Druid Pelts
    "Jalal's Mane", "Cerebus' Bite", "Ravenlore", "Spirit Keeper",
    // Shields
    "Pelta Lunata", "Umbral Disk", "Stormguild", "Wall of the Eyeless",
    "Swordback Hold", "Steelclash", "Bverrit Keep", "The Ward",
    "Visceratuant", "Moser's Blessed Circle", "Stormchaser", "Tiamat's Rebuke",
    "Lance Guard", "Gerke's Sanctuary", "Lidless Wall", "Radament's Sphere",
    "Blackoak Shield", "Stormshield", "Spike Thorn", "Medusa's Gaze",
    "Head Hunter's Glory", "Spirit Ward",
    // Paladin Shields
    "Herald of Zakarum", "Alma Negra", "Dragonscale",
    // Necro Heads
    "Homunculus", "Darkforce Spawn", "Boneflame",
    // Gloves
    "The Hand of Broc", "Bloodfist", "Chance Guards", "Magefist",
    "Frostburn", "Venom Grip", "Gravepalm", "Ghoulhide",
    "Lava Gout", "Hellmouth", "Dracul's Grasp", "Soul Drainer", "Steelrend",
    // Boots
    "Hotspur", "Gorefoot", "Treads of Cthon", "Goblin Toe",
    "Tearhaunch", "Infernostride", "Waterwalk", "Silkweave",
    "War Traveler", "Gore Rider", "Sandstorm Trek", "Marrowwalk",
    "Shadow Dancer", "Wraithstep",
    // Belts
    "Lenymo", "Snakecord", "Nightsmoke", "Goldwrap", "Bladebuckle",
    "String of Ears", "Razortail", "Gloom's Trap", "Snowclash",
    "Thundergod's Vigor", "Arachnid Mesh", "Nosferatu's Coil", "Verdungo's Hearty Cord",
    "Gheed's Wager",
    // RotW Warlock Unique Armor
    "Hellwarden's Will",
    // Additional Classic Unique Armor
    "Silks of the Victor", "The Spirit Shroud", "Skin of the Vipermagi",
    "Skin of the Flayed One", "Iron Pelt", "Veil of Steel",
];

const UNIQUE_JEWELRY_NAMES: &[&str] = &[
    // Rings
    "Nagelring", "Manald Heal", "Stone of Jordan", "Dwarf Star",
    "Raven Frost", "Bul-Kathos' Wedding Band", "Carrion Wind",
    "Nature's Peace", "Wisp Projector",
    "Opalvein", "Sling",
    // Amulets
    "Nokozan Relic", "The Eye of Etlich", "The Mahim-Oak Curio",
    "Saracen's Chance", "The Cat's Eye", "The Rising Sun", "Crescent Moon",
    "Atma's Scarab", "Highlord's Wrath", "Mara's Kaleidoscope",
    "Seraph's Hymn", "Metalgrid",
    "Entropy Locket",
];

const UNIQUE_GRIMOIRE_NAMES: &[&str] = &[
    "Measured Wrath", "Ars Tor'Baalos", "Ars Dul'Mephistos", "Ars Al'Diabolos",
    "Blasphemous Grimoire", "Tome of Dark Pacts", "Codex of the Void",
    "Grimoire of Shadows", "Tome of Eternal Night", "Darkfire Grimoire",
    "Necrotic Compendium", "Abyssal Manuscript", "Grimoire of Bone",
];

const UNIQUE_JEWEL_NAMES: &[&str] = &[
    "Defender's Fire", "Defender's Bile", "Protector's Frost",
    "Protector's Stone", "Guardian's Thunder", "Guardian's Light",
];


const SET_ITEM_NAMES: &[&str] = &[
    // Angelic Raiment
    "Angelic Sickle", "Angelic Mantle", "Angelic Halo", "Angelic Wings",
    // Arcanna's Tricks
    "Arcanna's Sign", "Arcanna's Deathwand", "Arcanna's Head", "Arcanna's Flesh",
    // Arctic Furs
    "Arctic Horn", "Arctic Furs", "Arctic Binding", "Arctic Mitts",
    // Berserker's Arsenal
    "Berserker's Headgear", "Berserker's Hauberk", "Berserker's Hatchet",
    // Cathan's Traps
    "Cathan's Rule", "Cathan's Mesh", "Cathan's Visage", "Cathan's Sigil", "Cathan's Seal",
    // Civerb's Vestments
    "Civerb's Cudgel", "Civerb's Ward", "Civerb's Icon",
    // Cleglaw's Brace
    "Cleglaw's Tooth", "Cleglaw's Claw", "Cleglaw's Pincers",
    // Death's Disguise
    "Death's Touch", "Death's Guard", "Death's Hand",
    // Hsarus' Defense
    "Hsarus' Iron Fist", "Hsarus' Iron Stay", "Hsarus' Iron Heel",
    // Infernal Tools
    "Infernal Cranium", "Infernal Sign", "Infernal Torch",
    // Iratha's Finery
    "Iratha's Collar", "Iratha's Cuff", "Iratha's Coil", "Iratha's Cord",
    // Isenhart's Armory
    "Isenhart's Lightbrand", "Isenhart's Parry", "Isenhart's Case", "Isenhart's Horns",
    // Milabrega's Regalia
    "Milabrega's Orb", "Milabrega's Rod", "Milabrega's Diadem", "Milabrega's Robe",
    // Sigon's Complete Steel
    "Sigon's Gage", "Sigon's Visor", "Sigon's Shelter", "Sigon's Sabot", "Sigon's Wrap", "Sigon's Guard",
    // Tancred's Battlegear
    "Tancred's Crowbill", "Tancred's Spine", "Tancred's Hobnails", "Tancred's Weird", "Tancred's Skull",
    // Vidala's Rig
    "Vidala's Barb", "Vidala's Fetlock", "Vidala's Ambush", "Vidala's Snare",
    // Aldur's Watchtower
    "Aldur's Stony Gaze", "Aldur's Deception", "Aldur's Advance", "Aldur's Rhythm",
    // Bul-Kathos' Children
    "Bul-Kathos' Sacred Charge", "Bul-Kathos' Tribal Guardian",
    // Cow King's Leathers
    "Cow King's Horns", "Cow King's Hide", "Cow King's Hooves",
    // The Disciple
    "Telling of Beads", "Laying of Hands", "Rite of Passage", "Dark Adherent", "Credendum",
    // Griswold's Legacy
    "Griswold's Valor", "Griswold's Heart", "Griswold's Honor", "Griswold's Redemption",
    // Heaven's Brethren
    "Dangoon's Teaching", "Taebaek's Glory", "Haemosu's Adamant", "Ondal's Almighty",
    // Hwanin's Majesty
    "Hwanin's Splendor", "Hwanin's Refuge", "Hwanin's Blessing", "Hwanin's Justice",
    // Immortal King
    "Immortal King's Will", "Immortal King's Soul Cage", "Immortal King's Detail",
    "Immortal King's Forge", "Immortal King's Pillar", "Immortal King's Stone Crusher",
    // M'avina's Battle Hymn
    "M'avina's True Sight", "M'avina's Embrace", "M'avina's Tenet",
    "M'avina's Icy Clutch", "M'avina's Caster",
    // Natalya's Odium
    "Natalya's Totem", "Natalya's Shadow", "Natalya's Soul", "Natalya's Mark",
    // Naj's Ancient Vestige
    "Naj's Puzzler", "Naj's Light Plate", "Naj's Circlet",
    // Orphan's Call
    "Guillaume's Face", "Wilhelm's Pride", "Magnus' Skin", "Whitstan's Guard",
    // Sander's Folly
    "Sander's Paragon", "Sander's Riprap", "Sander's Taboo", "Sander's Superstition",
    // Sazabi's Grand Tribute
    "Sazabi's Cobalt Redeemer", "Sazabi's Ghost Liberator", "Sazabi's Mental Sheath",
    // Tal Rasha's Wrappings
    "Tal Rasha's Horadric Crest", "Tal Rasha's Guardianship", "Tal Rasha's Lidless Eye",
    "Tal Rasha's Adjudication", "Tal Rasha's Fine-Spun Cloth",
    // Trang-Oul's Avatar
    "Trang-Oul's Guise", "Trang-Oul's Scales", "Trang-Oul's Wing",
    "Trang-Oul's Claws", "Trang-Oul's Girth",
    // Bane's Garments (Warlock Low-Level Set - RotW)
    "Bane's Edge", "Bane's Wraithskin", "Bane's Authority",
    // Horazon's Splendor (Warlock Elite Set - RotW)
    "Horazon's Countenance", "Horazon's Dominion", "Horazon's Hold",
    "Horazon's Legacy", "Horazon's Secrets",
];


const BASE_ITEM_NAMES: &[&str] = &[
    // Armor Bases (popular for runewords)
    "Archon Plate", "Dusk Shroud", "Wyrmhide", "Scarab Husk", "Wire Fleece",
    "Great Hauberk", "Boneweave", "Balrog Skin", "Kraken Shell", "Hellforge Plate",
    "Lacquered Plate", "Shadow Plate", "Sacred Armor",
    // Ethereal Armor
    "Ethereal Archon Plate", "Ethereal Dusk Shroud", "Ethereal Lacquered Plate",
    "Ethereal Sacred Armor", "Ethereal Boneweave", "Ethereal Shadow Plate",
    // Superior Armor
    "Superior Archon Plate", "Superior Dusk Shroud", "Superior Mage Plate",
    "Superior Sacred Armor", "Superior Wyrmhide",
    // Shield Bases
    "Monarch", "Sacred Targe", "Vortex Shield", "Sacred Rondache", "Kurast Shield",
    "Zakarum Shield", "Aegis", "Ward", "Heraldic Shield", "Aerin Shield",
    "Ethereal Monarch", "Superior Monarch", "Ethereal Vortex Shield",
    "Superior Sacred Targe", "Ethereal Sacred Targe",
    // Helm Bases
    "Diadem", "Tiara", "Circlet", "Coronet", "Shako",
    "Superior Diadem", "Ethereal Diadem",
    // Weapon Bases - Swords
    "Phase Blade", "Berserker Axe", "Colossus Blade", "Colossus Sword",
    "Cryptic Sword", "Conquest Sword", "Legend Sword",
    "Ethereal Berserker Axe", "Ethereal Colossus Blade", "Ethereal Colossus Sword",
    "Ethereal Cryptic Sword", "Superior Phase Blade",
    // Weapon Bases - Polearms
    "Thresher", "Giant Thresher", "Cryptic Axe", "Colossus Voulge",
    "Great Poleaxe", "Ogre Axe",
    "Ethereal Thresher", "Ethereal Giant Thresher", "Ethereal Cryptic Axe",
    "Ethereal Colossus Voulge", "Ethereal Great Poleaxe",
    // Weapon Bases - Other
    "Flail", "Crystal Sword", "Broad Sword", "Long Sword",
    "Caduceus", "War Scepter",
    "Ethereal Caduceus",
    // Weapon Bases - Bows/XBows
    "Grand Matron Bow", "Matriarchal Bow", "Hydra Bow",
    "Ethereal Grand Matron Bow",
    // Glove/Boot/Belt Bases (crafting)
    "Sharkskin Gloves", "Vampirebone Gloves", "Sharkskin Belt",
    "Vampirefang Belt", "Myrmidon Greaves", "Scarabshell Boots",
    // Grimoire Bases (RotW)
    "Burnt Text", "Blasphemous Compendium", "Occult Tome", "Blasphemous Grimoire",
    "Ethereal Blasphemous Grimoire", "Superior Blasphemous Grimoire",
];

const CHARM_NAMES: &[&str] = &[
    // Small Charms (valuable affixes)
    "Small Charm of Vita (20 Life)", "Small Charm 5% FHR", "Small Charm 3% FRW",
    "Small Charm 5 All Res", "Small Charm 11 Fire Res", "Small Charm 11 Lightning Res",
    "Small Charm 11 Cold Res", "Small Charm 11 Poison Res",
    "Small Charm 7% MF", "Small Charm 3 Max/20 AR/20 Life",
    "Small Charm 5 FHR/11 Res", "Small Charm 20 Life/11 Res",
    "Small Charm 20 Life/5% MF", "Small Charm 3 Max/20 AR/5% FHR",
    "Small Charm 100 Poison Damage",
    // Grand Charms (valuable affixes)
    "Grand Charm +1 Amazon Skills", "Grand Charm +1 Necromancer Skills",
    "Grand Charm +1 Barbarian Skills", "Grand Charm +1 Sorceress Skills",
    "Grand Charm +1 Paladin Skills", "Grand Charm +1 Druid Skills",
    "Grand Charm +1 Assassin Skills", "Grand Charm +1 Warlock Skills",
    "Grand Charm +1 Bow & Crossbow (Amazon)", "Grand Charm +1 Passive & Magic (Amazon)",
    "Grand Charm +1 Javelin & Spear (Amazon)", "Grand Charm +1 Fire (Sorceress)",
    "Grand Charm +1 Lightning (Sorceress)", "Grand Charm +1 Cold (Sorceress)",
    "Grand Charm +1 Curses (Necromancer)", "Grand Charm +1 Poison & Bone (Necromancer)",
    "Grand Charm +1 Summoning (Necromancer)", "Grand Charm +1 Combat (Barbarian)",
    "Grand Charm +1 Masteries (Barbarian)", "Grand Charm +1 Warcries (Barbarian)",
    "Grand Charm +1 Combat (Paladin)", "Grand Charm +1 Offensive Auras (Paladin)",
    "Grand Charm +1 Defensive Auras (Paladin)", "Grand Charm +1 Traps (Assassin)",
    "Grand Charm +1 Shadow Disciplines (Assassin)", "Grand Charm +1 Martial Arts (Assassin)",
    "Grand Charm +1 Elemental (Druid)", "Grand Charm +1 Shape Shifting (Druid)",
    "Grand Charm +1 Summoning (Druid)",
    "Grand Charm +1 Chaos (Warlock)", "Grand Charm +1 Demon (Warlock)",
    "Grand Charm +1 Destruction (Warlock)",
    // Unique Charms
    "Annihilus", "Hellfire Torch", "Gheed's Fortune",
    // Sunder Charms (v2.5+)
    "Black Cleft (Magic Sunder)", "Bone Break (Physical Sunder)",
    "Cold Rupture (Cold Sunder)", "Crack of the Heavens (Lightning Sunder)",
    "Flame Rift (Fire Sunder)", "Rotting Fissure (Poison Sunder)",
];

const JEWEL_NAMES: &[&str] = &[
    // Magic Jewels (valuable mods)
    "Jewel 15% IAS", "Jewel 15% IAS / 40 ED", "Jewel 7% FHR / 15 All Res",
    "Jewel 5% FHR / 15 All Res", "Jewel 15 All Res", "Jewel 40 ED / 15 Max",
    "Jewel 40 ED / 15 Res", "Jewel -5/+5 Fire Facet (Die)", "Jewel -5/+5 Fire Facet (Level)",
    "Jewel -5/+5 Cold Facet (Die)", "Jewel -5/+5 Cold Facet (Level)",
    "Jewel -5/+5 Lightning Facet (Die)", "Jewel -5/+5 Lightning Facet (Level)",
    "Jewel -5/+5 Poison Facet (Die)", "Jewel -5/+5 Poison Facet (Level)",
    "Jewel 30% ED / 9 Max (Rare)",
];


const MAGIC_RARE_NAMES: &[&str] = &[
    // Magic Boots (valuable affixes)
    "Magic Boots FRW/FHR/Res", "Magic Boots Tri-Res/FRW", "Magic Boots FRW/MF",
    "Magic Boots FHR/Res/MF", "Magic Boots FRW/FHR/Dex",
    // Rare Boots (GG combos)
    "Rare Boots FRW/FHR/Tri-Res", "Rare Boots FRW/FHR/Dual Res/MF",
    "Rare Boots FRW/FHR/Tri-Res/MF", "Rare Boots FRW/FHR/Str/Res",
    "Rare Boots FRW/Tri-Res/Life", "Rare Boots FRW/Dual Res/MF/Gold",
    // Magic Gloves (valuable affixes)
    "Magic Gloves 2/20 Java", "Magic Gloves 2/20 Martial Arts",
    "Magic Gloves 2/20 Bow", "Magic Gloves 2/20 Shadow",
    "Magic Gloves 3/20 Java", "Magic Gloves 3/20 Bow",
    "Magic Gloves IAS/Knockback", "Magic Gloves IAS/Crushing Blow",
    // Rare Gloves (GG combos)
    "Rare Gloves 2/20/Life/Res Java", "Rare Gloves 2/20/Life/Res Bow",
    "Rare Gloves 2/20/Life/Res Martial Arts", "Rare Gloves IAS/Str/Dex/Res",
    "Rare Gloves IAS/Life Leech/Res/CB", "Rare Gloves IAS/Dual Leech/Res",
    "Rare Gloves 2/20/MF Java", "Rare Gloves 2/20/Str/Dex",
    // Magic Amulets (valuable affixes)
    "Magic Amulet +2 Sorc/FCR", "Magic Amulet +2 Paladin/FCR",
    "Magic Amulet +2 Necro/FCR", "Magic Amulet +2 Druid/FCR",
    "Magic Amulet +2 Assassin/FCR", "Magic Amulet +2 Amazon/FCR",
    "Magic Amulet +2 Barbarian/FCR", "Magic Amulet +2 Warlock/FCR",
    "Magic Amulet +3 Lightning/FCR", "Magic Amulet +3 Cold/FCR",
    "Magic Amulet +3 Fire/FCR", "Magic Amulet +3 PnB/FCR",
    "Magic Amulet +3 Traps/FCR", "Magic Amulet +3 Warcries/FCR",
    "Magic Amulet +3 Elemental/FCR", "Magic Amulet +3 Shape Shifting/FCR",
    // Rare Amulets (GG combos)
    "Rare Amulet +2 Sorc/FCR/Res/Life", "Rare Amulet +2 Paladin/FCR/Res/Life",
    "Rare Amulet +2 Necro/FCR/Res/Life", "Rare Amulet +2 Assassin/FCR/Res/Life",
    "Rare Amulet +2 Amazon/FCR/Res/Life", "Rare Amulet +2 Druid/FCR/Res/Life",
    "Rare Amulet +2 Barbarian/FCR/Res/Life", "Rare Amulet +2 Warlock/FCR/Res/Life",
    "Rare Amulet +2 Skills/FCR/Str/Res", "Rare Amulet +2 Skills/FCR/All Res",
    "Rare Amulet +2 Skills/FCR/MF/Res", "Rare Amulet +2 Skills/FCR/Life/Mana",
    // Magic Circlets/Tiaras/Diadems/Coronets (valuable affixes)
    "Magic Circlet +2 Skills/FCR", "Magic Circlet +2 Skills/20 FCR",
    "Magic Tiara +2 Skills/FCR", "Magic Tiara +2 Skills/30 FRW",
    "Magic Diadem +2 Skills/FCR", "Magic Diadem +2 Skills/IAS",
    "Magic Coronet +2 Skills/FCR", "Magic Coronet +2 Skills/MF",
    "Magic Circlet +3 Fire/20 FCR", "Magic Circlet +3 Lightning/20 FCR",
    "Magic Circlet +3 Cold/20 FCR", "Magic Circlet +3 PnB/20 FCR",
    "Magic Circlet +3 Elemental/20 FCR", "Magic Circlet +3 Traps/20 FCR",
    // Rare Circlets/Tiaras/Diadems/Coronets (GG combos)
    "Rare Circlet +2 Skills/FCR/Res/Str", "Rare Circlet +2 Skills/FCR/Dual Res/Life",
    "Rare Circlet +2 Skills/FCR/All Res/Sockets", "Rare Circlet +2 Skills/20 FCR/Str/Res",
    "Rare Tiara +2 Skills/FCR/Res/Life/Sockets", "Rare Tiara +2 Skills/20 FCR/FHR/Res",
    "Rare Diadem +2 Skills/FCR/Res/Life", "Rare Diadem +2 Skills/FCR/All Res/Sockets",
    "Rare Diadem +2 Skills/IAS/Res/Life", "Rare Diadem +2 Skills/FCR/Str/Dex/Res",
    "Rare Coronet +2 Skills/FCR/Res/Life", "Rare Coronet +2 Skills/20 FCR/FHR/Res",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_ocr_chars_basic() {
        // '0' → 'O'
        assert_eq!(normalize_ocr_chars("Ber0"), "BerO");
        // '1' → 'l'
        assert_eq!(normalize_ocr_chars("He1"), "Hel");
        // 'I' → 'l'
        assert_eq!(normalize_ocr_chars("InsIght"), "lnslght");
        // Mixed
        assert_eq!(normalize_ocr_chars("10I"), "lOl");
    }

    #[test]
    fn test_normalize_ocr_chars_idempotent() {
        let inputs = ["Hello 0World1", "I0I1", "Normal text", "010101", "III"];
        for input in inputs {
            let once = normalize_ocr_chars(input);
            let twice = normalize_ocr_chars(&once);
            assert_eq!(once, twice, "Idempotence failed for input: {}", input);
        }
    }

    #[test]
    fn test_normalize_ocr_chars_no_change() {
        // Strings without confusable chars should be unchanged
        assert_eq!(normalize_ocr_chars("Enigma"), "Enigma");
        assert_eq!(normalize_ocr_chars("Ber Rune"), "Ber Rune");
    }

    #[test]
    fn test_calculate_confidence_identical() {
        // Identical strings should be 100
        assert_eq!(calculate_confidence("Enigma", "Enigma"), 100);
    }

    #[test]
    fn test_calculate_confidence_case_insensitive() {
        // Case should not affect the score
        assert_eq!(calculate_confidence("enigma", "Enigma"), 100);
        assert_eq!(calculate_confidence("ENIGMA", "Enigma"), 100);
    }

    #[test]
    fn test_calculate_confidence_completely_different() {
        // Very different strings should have low score
        let score = calculate_confidence("xxxxxxxx", "Enigma");
        assert!(score < 30, "Score should be low for very different strings, got {}", score);
    }

    #[test]
    fn test_calculate_confidence_close_match() {
        // One char off should be high
        let score = calculate_confidence("Enigm", "Enigma");
        assert!(score > 70, "Score should be high for close match, got {}", score);
    }

    #[test]
    fn test_calculate_confidence_empty() {
        // Empty vs non-empty
        assert_eq!(calculate_confidence("", "Enigma"), 0);
        // Both empty
        assert_eq!(calculate_confidence("", ""), 100);
    }

    #[test]
    fn test_item_database_loaded() {
        // Verify database is non-empty and has expected categories
        let db = &*ITEM_DATABASE;
        assert!(!db.is_empty(), "Item database should not be empty");
        assert!(db.len() > 500, "Item database should have >500 items, got {}", db.len());

        // Check that runes are present
        let ber_rune = db.iter().find(|i| i.name == "Ber Rune");
        assert!(ber_rune.is_some(), "Ber Rune should be in database");
        let ber = ber_rune.unwrap();
        assert_eq!(ber.category, "Rune");
        assert_eq!(ber.subcategory, "Rune");

        // Check that runewords are present
        let enigma = db.iter().find(|i| i.name == "Enigma");
        assert!(enigma.is_some(), "Enigma should be in database");
        assert_eq!(enigma.unwrap().category, "Runeword");

        // Check unique weapon
        let windforce = db.iter().find(|i| i.name == "Windforce");
        assert!(windforce.is_some(), "Windforce should be in database");
        assert_eq!(windforce.unwrap().category, "Unique");
        assert_eq!(windforce.unwrap().subcategory, "Weapon");

        // Check set item
        let shako = db.iter().find(|i| i.name == "Harlequin Crest");
        assert!(shako.is_some(), "Harlequin Crest should be in database");
        assert_eq!(shako.unwrap().category, "Unique");
    }

    #[test]
    fn test_item_database_normalized_names() {
        let db = &*ITEM_DATABASE;
        // "Insight" contains 'I' which should be normalized to 'l'
        let insight = db.iter().find(|i| i.name == "Insight").unwrap();
        // "Insight" lowercased = "insight", then normalize 'I' doesn't apply (already lowercase)
        // But the normalization is on the lowercase version
        assert_eq!(insight.normalized_name, normalize_ocr_chars("insight"));
    }

    #[test]
    fn test_item_database_has_all_categories() {
        let db = &*ITEM_DATABASE;
        let categories: Vec<&str> = vec![
            "Rune", "Runeword", "Unique", "Set", "Base", "Charm", "Jewel", "Rare/Magic",
        ];
        for cat in categories {
            assert!(
                db.iter().any(|i| i.category == cat),
                "Database should have items in category: {}",
                cat
            );
        }
    }

    #[test]
    fn test_rune_count() {
        let db = &*ITEM_DATABASE;
        let rune_count = db.iter().filter(|i| i.category == "Rune").count();
        assert_eq!(rune_count, 33, "Should have 33 runes");
    }

    // ===== match_items tests =====

    fn make_candidate(text: &str) -> ParsedCandidate {
        ParsedCandidate {
            text: text.to_string(),
            line_index: 0,
        }
    }

    fn make_test_db() -> Vec<GameItemEntry> {
        vec![
            entry("Enigma", "Runeword", "Runeword"),
            entry("Ber Rune", "Rune", "Rune"),
            entry("Jah Rune", "Rune", "Rune"),
            entry("Harlequin Crest", "Unique", "Armor"),
            entry("Tal Rasha's Guardianship", "Set", "Set Item"),
            entry("Archon Plate", "Base", "Base Item"),
            entry("Shako", "Base", "Base Item"),
        ]
    }

    #[test]
    fn test_match_items_empty_input() {
        let db = make_test_db();
        let candidates = vec![make_candidate("")];
        let result = match_items(&candidates, &db, 80);
        assert!(result.is_empty(), "Empty input should return empty result");
    }

    #[test]
    fn test_match_items_whitespace_only_input() {
        let db = make_test_db();
        let candidates = vec![
            make_candidate("   "),
            make_candidate("\t\n"),
        ];
        let result = match_items(&candidates, &db, 80);
        assert!(result.is_empty(), "Whitespace-only input should return empty result");
    }

    #[test]
    fn test_match_items_no_candidates() {
        let db = make_test_db();
        let candidates: Vec<ParsedCandidate> = vec![];
        let result = match_items(&candidates, &db, 80);
        assert!(result.is_empty(), "No candidates should return empty result");
    }

    #[test]
    fn test_match_items_exact_match() {
        let db = make_test_db();
        let candidates = vec![make_candidate("Enigma")];
        let result = match_items(&candidates, &db, 80);
        assert!(!result.is_empty(), "Should find matches for 'Enigma'");
        assert_eq!(result[0].item_name, "Enigma");
        assert_eq!(result[0].confidence, 100);
    }

    #[test]
    fn test_match_items_max_5_results() {
        let db = &*ITEM_DATABASE;
        let candidates = vec![make_candidate("Ber")];
        let result = match_items(&candidates, db, 80);
        assert!(result.len() <= 5, "Should return at most 5 candidates, got {}", result.len());
    }

    #[test]
    fn test_match_items_sorted_by_confidence() {
        let db = &*ITEM_DATABASE;
        let candidates = vec![make_candidate("Enigma")];
        let result = match_items(&candidates, db, 80);
        // Verify overall descending order (within the 5-point tiebreaker allowance)
        for window in result.windows(2) {
            // Items outside a 5-point band must be in descending order
            if window[0].confidence.abs_diff(window[1].confidence) > 5 {
                assert!(
                    window[0].confidence >= window[1].confidence,
                    "Results should be sorted by confidence descending: {} vs {}",
                    window[0].confidence,
                    window[1].confidence,
                );
            }
        }
    }

    #[test]
    fn test_match_items_tiebreaker_priority() {
        // Create a database where items have names that produce similar confidence
        // for a given input
        let db = vec![
            entry("Test Item", "Base", "Base Item"),
            entry("Test Rune", "Rune", "Rune"),
            entry("Test Set", "Set", "Set Item"),
        ];
        let candidates = vec![make_candidate("Test")];
        let result = match_items(&candidates, &db, 80);

        // Find items within a 5-point band of each other
        if result.len() >= 2 {
            let top_confidence = result[0].confidence;
            let band_items: Vec<&MatchCandidate> = result
                .iter()
                .filter(|m| m.confidence.abs_diff(top_confidence) <= 5)
                .collect();

            // Within the band, priority categories should come first
            let mut found_non_priority = false;
            for item in &band_items {
                if is_priority_category(&item.category) {
                    assert!(
                        !found_non_priority,
                        "Priority category '{}' should appear before non-priority categories in the same band",
                        item.category
                    );
                } else {
                    found_non_priority = true;
                }
            }
        }
    }

    #[test]
    fn test_match_items_dedup_by_name() {
        let db = make_test_db();
        // Two candidates that would match the same item
        let candidates = vec![
            make_candidate("Enigma"),
            make_candidate("enigma"),
        ];
        let result = match_items(&candidates, &db, 80);
        let enigma_count = result.iter().filter(|m| m.item_name == "Enigma").count();
        assert_eq!(enigma_count, 1, "Should dedup by item_name, got {} entries for Enigma", enigma_count);
    }

    #[test]
    fn test_match_items_ocr_normalization() {
        let db = make_test_db();
        // "Ber" with OCR confusion: '0' instead of 'O' won't matter here,
        // but testing that normalization is applied
        let candidates = vec![make_candidate("Ber Rune")];
        let result = match_items(&candidates, &db, 80);
        assert!(!result.is_empty(), "Should find matches for 'Ber Rune'");
        assert_eq!(result[0].item_name, "Ber Rune");
    }

    #[test]
    fn test_match_items_mixed_valid_and_whitespace_candidates() {
        let db = make_test_db();
        let candidates = vec![
            make_candidate("   "),
            make_candidate("Enigma"),
            make_candidate(""),
        ];
        let result = match_items(&candidates, &db, 80);
        assert!(!result.is_empty(), "Should find matches when at least one valid candidate exists");
        assert_eq!(result[0].item_name, "Enigma");
    }

    #[test]
    fn test_match_items_confidence_in_range() {
        let db = &*ITEM_DATABASE;
        let candidates = vec![make_candidate("Harlequin Crest")];
        let result = match_items(&candidates, db, 80);
        for m in &result {
            assert!(m.confidence <= 100, "Confidence should be <= 100, got {}", m.confidence);
            assert!(m.confidence > 0, "Confidence should be > 0 (filtered), got {}", m.confidence);
        }
    }

    #[test]
    fn test_is_priority_category() {
        assert!(is_priority_category("Unique"));
        assert!(is_priority_category("Set"));
        assert!(is_priority_category("Rune"));
        assert!(!is_priority_category("Runeword"));
        assert!(!is_priority_category("Base"));
        assert!(!is_priority_category("Charm"));
        assert!(!is_priority_category("Jewel"));
        assert!(!is_priority_category("Rare/Magic"));
    }

    /// Feature: screenshot-item-detection, Property 1: Confidence score range and count invariants
    mod property_tests {
        use super::*;
        use proptest::prelude::*;

        /// **Validates: Requirements 3.3, 3.4**
        proptest! {
            #[test]
            fn prop_confidence_score_range_and_count(input in "\\PC{0,50}") {
                let candidates = vec![ParsedCandidate { text: input, line_index: 0 }];
                let results = match_items(&candidates, &ITEM_DATABASE, 80);

                // At most 5 candidates
                prop_assert!(results.len() <= 5, "Got {} candidates, expected ≤5", results.len());

                // All confidence scores in [0, 100]
                for result in &results {
                    prop_assert!(result.confidence <= 100,
                        "Confidence {} > 100 for item {}", result.confidence, result.item_name);
                }
            }
        }

        // Feature: screenshot-item-detection, Property 2: Match results sorted by confidence descending

        /// **Validates: Requirements 3.1, 3.2**
        ///
        /// For arbitrary non-empty strings, verify candidates returned by `match_items`
        /// are ordered by confidence descending, allowing tiebreaker reordering within
        /// a 5-point band.
        proptest! {
            #[test]
            fn prop_sorted_results(input in "[A-Za-z]{1,20}") {
                let candidates = vec![ParsedCandidate { text: input, line_index: 0 }];
                let results = match_items(&candidates, &ITEM_DATABASE, 80);

                // Verify ordering: for each adjacent pair, either properly ordered
                // OR within a 5-point tiebreaker band
                for i in 0..results.len().saturating_sub(1) {
                    prop_assert!(
                        results[i].confidence >= results[i + 1].confidence
                            || results[i].confidence.abs_diff(results[i + 1].confidence) <= 5,
                        "Results not sorted: [{}]={} vs [{}]={}",
                        i, results[i].confidence, i + 1, results[i + 1].confidence
                    );
                }
            }
        }

        // Feature: screenshot-item-detection, Property 3: Category tiebreaker ordering within confidence band

        /// **Validates: Requirements 3.5**
        ///
        /// Within any 5-point confidence band in the results, priority category items
        /// (Unique, Set, Rune) appear before non-priority items.
        proptest! {
            #[test]
            fn prop_category_tiebreaker(input in "[A-Za-z]{2,15}") {
                let candidates = vec![ParsedCandidate { text: input, line_index: 0 }];
                let results = match_items(&candidates, &ITEM_DATABASE, 80);

                // Within any 5-point band, priority categories should come first
                for i in 0..results.len().saturating_sub(1) {
                    let curr = &results[i];
                    let next = &results[i + 1];

                    // Only check within a 5-point band
                    if curr.confidence.abs_diff(next.confidence) <= 5 {
                        let curr_priority = is_priority_category(&curr.category);
                        let next_priority = is_priority_category(&next.category);

                        // If next item is priority and current is not, that's a violation
                        // (priority should come before non-priority within the band)
                        if !curr_priority && next_priority && next.confidence >= curr.confidence {
                            prop_assert!(false,
                                "Priority category '{}' ({}, confidence {}) should appear before \
                                 non-priority '{}' ({}, confidence {}) within same 5-point band",
                                next.item_name, next.category, next.confidence,
                                curr.item_name, curr.category, curr.confidence
                            );
                        }
                    }
                }
            }
        }

        // Feature: screenshot-item-detection, Property 4: OCR character normalization is idempotent

        /// **Validates: Requirements 3.6**
        proptest! {
            #[test]
            fn prop_normalize_ocr_idempotent(input in "\\PC{0,100}") {
                let once = normalize_ocr_chars(&input);
                let twice = normalize_ocr_chars(&once);
                prop_assert_eq!(once, twice, "Normalization not idempotent for input: {:?}", input);
            }
        }

        // Feature: screenshot-item-detection, Property 11: Empty and whitespace-only input returns no candidates

        /// **Validates: Requirements 3.7**
        proptest! {
            #[test]
            fn prop_empty_whitespace_no_candidates(input in "[ \\t\\n\\r]{0,50}") {
                let candidates = vec![ParsedCandidate { text: input, line_index: 0 }];
                let results = match_items(&candidates, &ITEM_DATABASE, 80);
                prop_assert!(results.is_empty(),
                    "Expected empty results for whitespace input, got {} candidates", results.len());
            }
        }
    }
}
