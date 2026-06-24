// Item Value Estimation - Tier mapping based on D2R community pricing
// Sources: d2jsp forum gold values, traderie.com, diablo2.io, maxroll.gg

export type TierName = "worthless" | "low" | "mid" | "high" | "gg";

export interface ItemTier {
  name: TierName;
  label: string;
  points: number;
  color: string;
  cssClass: string;
}

export const TIERS: Record<TierName, ItemTier> = {
  worthless: { name: "worthless", label: "Worthless", points: 0, color: "#6b7280", cssClass: "tier-worthless" },
  low: { name: "low", label: "Low", points: 1, color: "#22c55e", cssClass: "tier-low" },
  mid: { name: "mid", label: "Mid", points: 3, color: "#3b82f6", cssClass: "tier-mid" },
  high: { name: "high", label: "High", points: 8, color: "#a855f7", cssClass: "tier-high" },
  gg: { name: "gg", label: "GG", points: 20, color: "#f59e0b", cssClass: "tier-gg" },
};

export const TIER_NAMES: TierName[] = ["worthless", "low", "mid", "high", "gg"];

// Rune tier mapping (by rune number 1-33)
// Worthless: El-Dol (1-14), Low: Hel-Lem (15-20), Mid: Pul-Ist (21-24), High: Gul-Lo (25-28), GG: Sur-Zod (29-33)
const RUNE_ORDER = [
  "El", "Eld", "Tir", "Nef", "Eth", "Ith", "Tal", "Ral", "Ort", "Thul",
  "Amn", "Sol", "Shael", "Dol", "Hel", "Io", "Lum", "Ko", "Fal", "Lem",
  "Pul", "Um", "Mal", "Ist", "Gul", "Vex", "Ohm", "Lo", "Sur", "Ber",
  "Jah", "Cham", "Zod",
];

function getRuneTier(name: string): TierName {
  // Extract rune name from "X Rune" format
  const runeName = name.replace(" Rune", "");
  const index = RUNE_ORDER.indexOf(runeName);
  if (index === -1) return "worthless";
  if (index < 14) return "worthless"; // El-Dol
  if (index < 20) return "low";       // Hel-Lem
  if (index < 24) return "mid";       // Pul-Ist
  if (index < 28) return "high";      // Gul-Lo
  return "gg";                         // Sur-Zod
}

// Runeword tiers based on rune cost and demand
const RUNEWORD_TIERS: Record<string, TierName> = {
  // GG
  "Enigma": "gg", "Infinity": "gg", "Last Wish": "gg", "Breath of the Dying": "gg",
  "Faith": "gg", "Chains of Honor": "gg", "Grief": "gg", "Phoenix": "gg", "Dream": "gg",
  "Brand": "gg", "Ice": "gg", "Hand of Justice": "gg", "Destruction": "gg",
  // High
  "Heart of the Oak": "high", "Call to Arms": "high", "Exile": "high", "Doom": "high",
  "Death": "high", "Dragon": "high", "Fortitude": "high", "Pride": "high",
  "Famine": "high", "Silence": "high", "Eternity": "high", "Plague": "high",
  "Mist": "high", "Obsession": "high", "Flickering Flame": "high",
  // Mid
  "Spirit": "mid", "Insight": "mid", "Treachery": "mid", "Duress": "mid",
  "Obedience": "mid", "Hustle": "mid", "Smoke": "mid", "Kingslayer": "mid",
  "Crescent Moon": "mid", "Oath": "mid", "Lawbringer": "mid", "Venom": "mid",
  "Rift": "mid", "Sanctuary": "mid", "Prudence": "mid", "Delirium": "mid",
  "Gloom": "mid", "Stone": "mid", "Wind": "mid", "Metamorphosis": "mid",
  "Mosaic": "mid", "Unbending Will": "mid", "Chaos": "mid",
  // Low
  "Stealth": "low", "Lore": "low", "Rhyme": "low", "Ancient's Pledge": "low",
  "Leaf": "low", "Nadir": "low", "Edge": "low", "Beast": "low", "Black": "low",
  "Bone": "low", "Bramble": "low", "Enlightenment": "low", "Fury": "low",
  "Harmony": "low", "Holy Thunder": "low", "Honor": "low", "King's Grace": "low",
  "Lionheart": "low", "Malice": "low", "Melody": "low", "Memory": "low",
  "Myth": "low", "Passion": "low", "Peace": "low", "Radiance": "low",
  "Rain": "low", "Splendor": "low", "Steel": "low", "Strength": "low",
  "Voice of Reason": "low", "Wealth": "low", "White": "low", "Wrath": "low",
  "Zephyr": "low", "Bulwark": "low", "Cure": "low", "Ground": "low",
  "Hearth": "low", "Pattern": "low", "Temper": "low", "Wisdom": "low",
  // RotW runewords
  "Authority": "mid", "Coven": "mid", "Void": "mid", "Vigilance": "low", "Ritual": "low",
};

// Unique item tiers
const UNIQUE_TIERS: Record<string, TierName> = {
  // GG Uniques
  "Tyrael's Might": "gg", "Griffon's Eye": "gg", "Death's Fathom": "gg",
  "Windforce": "gg", "The Grandfather": "gg", "Crown of Ages": "gg",
  "Mang Song's Lesson": "gg", "Astreon's Iron Ward": "gg",
  "Death's Web": "gg", "Nightwing's Veil": "gg", "Stormlash": "gg",
  "Schaefer's Hammer": "gg", "Templar's Might": "gg",
  // High Uniques
  "Harlequin Crest": "high", "Arachnid Mesh": "high", "War Traveler": "high",
  "Stone of Jordan": "high", "Mara's Kaleidoscope": "high",
  "Herald of Zakarum": "high", "Highlord's Wrath": "high",
  "Andariel's Visage": "high", "Verdungo's Hearty Cord": "high",
  "Thunderstroke": "high", "Titan's Revenge": "high", "Raven Frost": "high",
  "Arreat's Face": "high", "The Oculus": "high", "Eschuta's Temper": "high",
  "Azurewrath": "high", "Lightsabre": "high", "Shadow Dancer": "high",
  "Steelrend": "high", "Wisp Projector": "high", "Kira's Guardian": "high",
  "Arkaine's Valor": "high", "The Reaper's Toll": "high", "Tomb Reaver": "high",
  "Nosferatu's Coil": "high", "Bul-Kathos' Wedding Band": "high",
  "Sandstorm Trek": "high", "String of Ears": "high",
  "Dracul's Grasp": "high", "Leviathan": "high",
  "Bartuc's Cut-Throat": "high", "Doombringer": "high",
  // Mid Uniques
  "Skin of the Vipermagi": "mid", "Goldwrap": "mid", "Magefist": "mid",
  "Chance Guards": "mid", "Vampire Gaze": "mid", "Stormshield": "mid",
  "Homunculus": "mid", "Skullder's Ire": "mid", "Jalal's Mane": "mid",
  "Gore Rider": "mid", "Laying of Hands": "mid",
  "Shaftstop": "mid", "Guardian Angel": "mid", "Ormus' Robes": "mid",
  "Thundergod's Vigor": "mid", "Razortail": "mid", "Frostburn": "mid",
  "Waterwalk": "mid", "Silkweave": "mid", "Valkyrie Wing": "mid",
  "Ravenlore": "mid", "Cerebus' Bite": "mid", "Spirit Keeper": "mid",
  "Jade Talon": "mid", "Lidless Wall": "mid", "Alma Negra": "mid",
  "Wizardspike": "mid", "Ribcracker": "mid", "Bonehew": "mid",
  "Earth Shifter": "mid", "Cranium Basher": "mid", "Stormspire": "mid",
  "Eaglehorn": "mid", "Widowmaker": "mid", "Buriza-Do Kyanon": "mid",
  "Que-Hegan's Wisdom": "mid", "Duriel's Shell": "mid",
  "The Gladiator's Bane": "mid", "Steel Carapace": "mid",
  "Wolfhowl": "mid", "Demonhorn's Edge": "mid",
  "Fleshripper": "mid", "Warshrike": "mid", "Gimmershred": "mid",
  "Giant Skull": "mid", "Crown of Thieves": "mid",
  "Atma's Scarab": "mid", "The Cat's Eye": "mid", "Seraph's Hymn": "mid",
  "Metalgrid": "mid", "Nature's Peace": "mid", "Dwarf Star": "mid",
  "Nagelring": "mid", "Horizon's Tornado": "mid",
  "Ondal's Wisdom": "mid", "Arioc's Needle": "mid",
  // Low Uniques
  "Peasant Crown": "low", "Rockstopper": "low", "Stealskull": "low",
  "Bloodfist": "low", "Goblin Toe": "low", "Infernostride": "low",
  "Tearhaunch": "low", "Nightsmoke": "low", "Snowclash": "low",
  "Moser's Blessed Circle": "low", "Blackhorn's Face": "low",
  "Gerke's Sanctuary": "low", "Radament's Sphere": "low",
  "Head Hunter's Glory": "low", "Spirit Ward": "low",
  "Soul Drainer": "low", "Lava Gout": "low", "Hellmouth": "low",
  "Venom Grip": "low", "Ghoulhide": "low", "Gravepalm": "low",
  "Hotspur": "low", "Gorefoot": "low", "Treads of Cthon": "low",
  "Marrowwalk": "low", "Wraithstep": "low",
  "Gloom's Trap": "low", "Bladebuckle": "low", "Snakecord": "low",
  "Manald Heal": "low", "Carrion Wind": "low",
  "Nokozan Relic": "low", "The Eye of Etlich": "low", "The Mahim-Oak Curio": "low",
  "Saracen's Chance": "low", "The Rising Sun": "low",
  "Suicide Branch": "low", "Arm of King Leoric": "low", "Boneshade": "low",
  "Firelizard's Talons": "low", "Shadow Killer": "low",
  "Hone Sundan": "low", "Spire of Honor": "low",
  "Heaven's Light": "low", "The Redeemer": "low",
  "Butcher's Pupil": "low", "Islestrike": "low",
  "Razor's Edge": "low", "Rune Master": "low", "Cranebeak": "low",
  "Death Cleaver": "low", "Messerschmidt's Reaver": "low",
  "Stone Crusher": "low", "Windhammer": "low",
  "Demon Limb": "low", "Baranar's Star": "low", "Nord's Tenderizer": "low",
  "Flamebellow": "low", "Bloodmoon": "low",
  "Lycander's Flank": "low", "Blood Raven's Charge": "low", "Stoneraven": "low",
  "Skystrike": "low", "Goldstrike Arch": "low",
  "Witchwild String": "low", "Cliffkiller": "low", "Magewrath": "low",
  "Hellrack": "low", "Gut Siphon": "low",
  "Chromatic Ire": "low", "Warpspear": "low", "Skull Collector": "low",
  "Darkforce Spawn": "low", "Boneflame": "low", "Dragonscale": "low",
};

// Set item tiers
const SET_TIERS: Record<string, TierName> = {
  // High
  "Tal Rasha's Guardianship": "high",
  "Immortal King's Stone Crusher": "high",
  "Trang-Oul's Claws": "high",
  "Griswold's Honor": "high",
  "Griswold's Redemption": "high",
  // Mid
  "Tal Rasha's Adjudication": "mid", "Tal Rasha's Fine-Spun Cloth": "mid",
  "Tal Rasha's Horadric Crest": "mid", "Tal Rasha's Lidless Eye": "mid",
  "Immortal King's Will": "mid", "Immortal King's Soul Cage": "mid",
  "Immortal King's Detail": "mid", "Immortal King's Forge": "mid",
  "Immortal King's Pillar": "mid",
  "Guillaume's Face": "mid",
  "Natalya's Totem": "mid", "Natalya's Shadow": "mid",
  "Natalya's Soul": "mid", "Natalya's Mark": "mid",
  "Trang-Oul's Guise": "mid", "Trang-Oul's Scales": "mid",
  "Trang-Oul's Wing": "mid", "Trang-Oul's Girth": "mid",
  "Griswold's Valor": "mid", "Griswold's Heart": "mid",
  "Aldur's Stony Gaze": "mid", "Aldur's Deception": "mid",
  "Aldur's Advance": "mid", "Aldur's Rhythm": "mid",
  "M'avina's True Sight": "mid", "M'avina's Embrace": "mid",
  "M'avina's Tenet": "mid", "M'avina's Icy Clutch": "mid", "M'avina's Caster": "mid",
  "Bul-Kathos' Sacred Charge": "mid", "Bul-Kathos' Tribal Guardian": "mid",
  // RotW sets
  "Horazon's Countenance": "mid", "Horazon's Dominion": "mid",
  "Horazon's Hold": "mid", "Horazon's Legacy": "mid", "Horazon's Secrets": "mid",
  // Low
  "Laying of Hands": "low", "Credendum": "low", "Dark Adherent": "low",
  "Telling of Beads": "low", "Rite of Passage": "low",
  "Wilhelm's Pride": "low", "Magnus' Skin": "low", "Whitstan's Guard": "low",
  "Cow King's Horns": "low", "Cow King's Hide": "low", "Cow King's Hooves": "low",
  "Sander's Paragon": "low", "Sander's Riprap": "low",
  "Sander's Taboo": "low", "Sander's Superstition": "low",
  "Hwanin's Splendor": "low", "Hwanin's Refuge": "low",
  "Hwanin's Blessing": "low", "Hwanin's Justice": "low",
  "Naj's Puzzler": "low", "Naj's Light Plate": "low", "Naj's Circlet": "low",
  "Sazabi's Cobalt Redeemer": "low", "Sazabi's Ghost Liberator": "low", "Sazabi's Mental Sheath": "low",
  "Dangoon's Teaching": "low", "Taebaek's Glory": "low",
  "Haemosu's Adamant": "low", "Ondal's Almighty": "low",
  "Bane's Edge": "low", "Bane's Wraithskin": "low", "Bane's Authority": "low",
};

// Charm tiers
const CHARM_TIERS: Record<string, TierName> = {
  // GG
  "Annihilus": "gg", "Hellfire Torch": "gg",
  // High - skillers with life, sunder charms
  "Black Cleft (Magic Sunder)": "high", "Bone Break (Physical Sunder)": "high",
  "Cold Rupture (Cold Sunder)": "high", "Crack of the Heavens (Lightning Sunder)": "high",
  "Flame Rift (Fire Sunder)": "high", "Rotting Fissure (Poison Sunder)": "high",
  "Gheed's Fortune": "high",
  // Mid - plain skillers, good small charms
  "Small Charm 3 Max/20 AR/20 Life": "mid",
  "Small Charm 5 FHR/11 Res": "mid", "Small Charm 20 Life/11 Res": "mid",
  "Small Charm 20 Life/5% MF": "mid", "Small Charm 3 Max/20 AR/5% FHR": "mid",
  // Low - basic small charms
  "Small Charm of Vita (20 Life)": "low", "Small Charm 5% FHR": "low",
  "Small Charm 3% FRW": "low", "Small Charm 5 All Res": "low",
  "Small Charm 11 Fire Res": "low", "Small Charm 11 Lightning Res": "low",
  "Small Charm 11 Cold Res": "low", "Small Charm 11 Poison Res": "low",
  "Small Charm 7% MF": "low", "Small Charm 100 Poison Damage": "low",
};

// Grand charm skillers are mid tier by default
function isGrandSkiller(name: string): boolean {
  return name.startsWith("Grand Charm +1");
}

// Jewel tiers
const JEWEL_TIERS: Record<string, TierName> = {
  "Jewel 15% IAS / 40 ED": "gg",
  "Jewel -5/+5 Fire Facet (Die)": "high", "Jewel -5/+5 Fire Facet (Level)": "high",
  "Jewel -5/+5 Cold Facet (Die)": "high", "Jewel -5/+5 Cold Facet (Level)": "high",
  "Jewel -5/+5 Lightning Facet (Die)": "high", "Jewel -5/+5 Lightning Facet (Level)": "high",
  "Jewel -5/+5 Poison Facet (Die)": "high", "Jewel -5/+5 Poison Facet (Level)": "high",
  "Jewel 40 ED / 15 Max": "high", "Jewel 40 ED / 15 Res": "mid",
  "Jewel 15% IAS": "mid", "Jewel 7% FHR / 15 All Res": "mid",
  "Jewel 5% FHR / 15 All Res": "mid", "Jewel 15 All Res": "mid",
  "Jewel 30% ED / 9 Max (Rare)": "mid",
};

// Unique jewel tiers (Colossal Ancient)
const UNIQUE_JEWEL_TIERS: Record<string, TierName> = {
  "Defender's Fire": "mid", "Defender's Bile": "mid",
  "Protector's Frost": "mid", "Protector's Stone": "mid",
  "Guardian's Thunder": "mid", "Guardian's Light": "mid",
};

// Base item tiers (ethereal/superior bases for runewords)
const BASE_TIERS: Record<string, TierName> = {
  // GG Bases
  "Ethereal Berserker Axe": "high", "Ethereal Colossus Blade": "high",
  "Ethereal Giant Thresher": "high", "Ethereal Thresher": "high",
  "Ethereal Cryptic Axe": "high", "Ethereal Sacred Armor": "high",
  "Ethereal Archon Plate": "mid", "Ethereal Dusk Shroud": "mid",
  "Ethereal Lacquered Plate": "mid", "Ethereal Boneweave": "mid",
  "Ethereal Shadow Plate": "mid", "Ethereal Colossus Voulge": "mid",
  "Ethereal Great Poleaxe": "mid", "Ethereal Colossus Sword": "mid",
  "Ethereal Cryptic Sword": "mid", "Ethereal Monarch": "mid",
  "Ethereal Vortex Shield": "mid", "Ethereal Sacred Targe": "mid",
  "Ethereal Grand Matron Bow": "mid", "Ethereal Caduceus": "mid",
  "Ethereal Diadem": "mid", "Ethereal Blasphemous Grimoire": "mid",
  // Superior bases
  "Superior Archon Plate": "low", "Superior Dusk Shroud": "low",
  "Superior Mage Plate": "low", "Superior Sacred Armor": "low",
  "Superior Wyrmhide": "low", "Superior Monarch": "low",
  "Superior Sacred Targe": "low", "Superior Phase Blade": "low",
  "Superior Diadem": "low", "Superior Blasphemous Grimoire": "low",
  // Normal sought-after bases
  "Monarch": "low", "Sacred Targe": "low", "Vortex Shield": "low",
  "Phase Blade": "low", "Berserker Axe": "low", "Diadem": "low",
  "Thresher": "low", "Giant Thresher": "low", "Cryptic Axe": "low",
  "Archon Plate": "low", "Dusk Shroud": "low",
};

// Magic/Rare item tiers
const MAGIC_RARE_TIERS: Record<string, TierName> = {
  // GG rares
  "Rare Gloves 2/20/Life/Res Java": "gg", "Rare Gloves 2/20/Life/Res Bow": "gg",
  "Rare Gloves 2/20/Life/Res Martial Arts": "gg",
  "Rare Boots FRW/FHR/Tri-Res/MF": "gg",
  "Rare Circlet +2 Skills/FCR/All Res/Sockets": "gg",
  "Rare Diadem +2 Skills/FCR/All Res/Sockets": "gg",
  "Rare Amulet +2 Sorc/FCR/Res/Life": "gg", "Rare Amulet +2 Paladin/FCR/Res/Life": "gg",
  "Rare Amulet +2 Necro/FCR/Res/Life": "gg",
  // High rares
  "Rare Boots FRW/FHR/Tri-Res": "high", "Rare Boots FRW/FHR/Dual Res/MF": "high",
  "Rare Boots FRW/FHR/Str/Res": "high", "Rare Boots FRW/Tri-Res/Life": "high",
  "Rare Gloves IAS/Dual Leech/Res": "high", "Rare Gloves IAS/Life Leech/Res/CB": "high",
  "Rare Circlet +2 Skills/FCR/Res/Str": "high", "Rare Circlet +2 Skills/FCR/Dual Res/Life": "high",
  "Rare Circlet +2 Skills/20 FCR/Str/Res": "high",
  "Rare Tiara +2 Skills/FCR/Res/Life/Sockets": "high", "Rare Tiara +2 Skills/20 FCR/FHR/Res": "high",
  "Rare Diadem +2 Skills/FCR/Res/Life": "high", "Rare Diadem +2 Skills/IAS/Res/Life": "high",
  "Rare Diadem +2 Skills/FCR/Str/Dex/Res": "high",
  "Rare Amulet +2 Assassin/FCR/Res/Life": "high", "Rare Amulet +2 Amazon/FCR/Res/Life": "high",
  "Rare Amulet +2 Druid/FCR/Res/Life": "high", "Rare Amulet +2 Barbarian/FCR/Res/Life": "high",
  "Rare Amulet +2 Warlock/FCR/Res/Life": "high",
  "Rare Amulet +2 Skills/FCR/Str/Res": "high", "Rare Amulet +2 Skills/FCR/All Res": "high",
  "Rare Amulet +2 Skills/FCR/MF/Res": "high", "Rare Amulet +2 Skills/FCR/Life/Mana": "high",
  "Rare Coronet +2 Skills/FCR/Res/Life": "high", "Rare Coronet +2 Skills/20 FCR/FHR/Res": "high",
  // Mid magic/rares
  "Magic Gloves 3/20 Java": "mid", "Magic Gloves 3/20 Bow": "mid",
  "Magic Gloves 2/20 Java": "mid", "Magic Gloves 2/20 Martial Arts": "mid",
  "Magic Gloves 2/20 Bow": "mid", "Magic Gloves 2/20 Shadow": "mid",
  "Rare Gloves IAS/Str/Dex/Res": "mid", "Rare Gloves 2/20/MF Java": "mid",
  "Rare Gloves 2/20/Str/Dex": "mid",
  "Rare Boots FRW/Dual Res/MF/Gold": "mid",
  "Magic Amulet +2 Sorc/FCR": "mid", "Magic Amulet +2 Paladin/FCR": "mid",
  "Magic Amulet +2 Necro/FCR": "mid", "Magic Amulet +2 Druid/FCR": "mid",
  "Magic Amulet +2 Assassin/FCR": "mid", "Magic Amulet +2 Amazon/FCR": "mid",
  "Magic Amulet +2 Barbarian/FCR": "mid", "Magic Amulet +2 Warlock/FCR": "mid",
  "Magic Amulet +3 Lightning/FCR": "mid", "Magic Amulet +3 Cold/FCR": "mid",
  "Magic Amulet +3 Fire/FCR": "mid", "Magic Amulet +3 PnB/FCR": "mid",
  "Magic Amulet +3 Traps/FCR": "mid", "Magic Amulet +3 Warcries/FCR": "mid",
  "Magic Amulet +3 Elemental/FCR": "mid", "Magic Amulet +3 Shape Shifting/FCR": "mid",
  "Magic Circlet +2 Skills/20 FCR": "mid", "Magic Circlet +2 Skills/FCR": "mid",
  "Magic Tiara +2 Skills/FCR": "mid", "Magic Diadem +2 Skills/FCR": "mid",
  "Magic Coronet +2 Skills/FCR": "mid",
  "Magic Circlet +3 Fire/20 FCR": "mid", "Magic Circlet +3 Lightning/20 FCR": "mid",
  "Magic Circlet +3 Cold/20 FCR": "mid", "Magic Circlet +3 PnB/20 FCR": "mid",
  "Magic Circlet +3 Elemental/20 FCR": "mid", "Magic Circlet +3 Traps/20 FCR": "mid",
  // Low
  "Magic Boots FRW/FHR/Res": "low", "Magic Boots Tri-Res/FRW": "low",
  "Magic Boots FRW/MF": "low", "Magic Boots FHR/Res/MF": "low", "Magic Boots FRW/FHR/Dex": "low",
  "Magic Gloves IAS/Knockback": "low", "Magic Gloves IAS/Crushing Blow": "low",
  "Magic Tiara +2 Skills/30 FRW": "low", "Magic Diadem +2 Skills/IAS": "low",
  "Magic Coronet +2 Skills/MF": "low",
};

/**
 * Get the value tier for an item by name.
 * Uses category-specific lookup maps and falls back to sensible defaults.
 */
export function getItemTier(itemName: string, category?: string): ItemTier {
  const tierName = getItemTierName(itemName, category);
  return TIERS[tierName];
}

/**
 * Get just the tier name string for an item.
 */
export function getItemTierName(itemName: string, category?: string): TierName {
  // Runes
  if (itemName.endsWith(" Rune") || category === "Rune") {
    return getRuneTier(itemName);
  }

  // Runewords
  if (category === "Runeword" || RUNEWORD_TIERS[itemName] !== undefined) {
    return RUNEWORD_TIERS[itemName] ?? "low";
  }

  // Charms
  if (category === "Charm" || CHARM_TIERS[itemName] !== undefined) {
    if (CHARM_TIERS[itemName] !== undefined) return CHARM_TIERS[itemName];
    if (isGrandSkiller(itemName)) return "mid";
    return "low";
  }

  // Jewels (crafted)
  if (category === "Jewel" || JEWEL_TIERS[itemName] !== undefined) {
    return JEWEL_TIERS[itemName] ?? "low";
  }

  // Unique jewels (Colossal Ancient)
  if (UNIQUE_JEWEL_TIERS[itemName] !== undefined) {
    return UNIQUE_JEWEL_TIERS[itemName];
  }

  // Set items
  if (category === "Set" || SET_TIERS[itemName] !== undefined) {
    return SET_TIERS[itemName] ?? "worthless";
  }

  // Unique items
  if (category === "Unique" || UNIQUE_TIERS[itemName] !== undefined) {
    return UNIQUE_TIERS[itemName] ?? "worthless";
  }

  // Base items
  if (category === "Base" || BASE_TIERS[itemName] !== undefined) {
    return BASE_TIERS[itemName] ?? "worthless";
  }

  // Magic/Rare items
  if (category === "Rare/Magic" || MAGIC_RARE_TIERS[itemName] !== undefined) {
    return MAGIC_RARE_TIERS[itemName] ?? "low";
  }

  // Default: unknown items are worthless
  return "worthless";
}

/**
 * Calculate total points from a list of item names.
 */
export function calculateTotalValue(items: Array<{ name: string; rarity?: string }>): number {
  return items.reduce((total, item) => {
    const tier = getItemTier(item.name, item.rarity);
    return total + tier.points;
  }, 0);
}

/**
 * Get tier breakdown counts from a list of items.
 */
export function getTierBreakdown(items: Array<{ name: string; rarity?: string }>): Record<TierName, number> {
  const breakdown: Record<TierName, number> = {
    worthless: 0, low: 0, mid: 0, high: 0, gg: 0,
  };
  for (const item of items) {
    const tier = getItemTier(item.name, item.rarity);
    breakdown[tier.name]++;
  }
  return breakdown;
}
