// D2R v3.2 - Reign of the Warlock - Complete Item Database
// Categories: Runes, Runewords, Unique Items, Set Items, Notable Bases, Charms, Jewels

export interface GameItem {
  name: string;
  category: string;
  subcategory: string;
}

// ===== RUNES (33 total) =====
const RUNES: GameItem[] = [
  "El", "Eld", "Tir", "Nef", "Eth", "Ith", "Tal", "Ral", "Ort", "Thul",
  "Amn", "Sol", "Shael", "Dol", "Hel", "Io", "Lum", "Ko", "Fal", "Lem",
  "Pul", "Um", "Mal", "Ist", "Gul", "Vex", "Ohm", "Lo", "Sur", "Ber",
  "Jah", "Cham", "Zod"
].map(name => ({ name: `${name} Rune`, category: "Rune", subcategory: "Rune" }));

// ===== RUNEWORDS (89 classic + 5 RotW + ladder = ~99 total) =====
const RUNEWORDS: GameItem[] = [
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
  "Authority", "Coven", "Void", "Vigilance", "Ritual"
].map(name => ({ name, category: "Runeword", subcategory: "Runeword" }));

// ===== UNIQUE WEAPONS =====
const UNIQUE_WEAPONS: GameItem[] = [
  // Axes
  "The Gnasher", "Deathspade", "Bladebone", "Skull Splitter", "Rakescar",
  "Axe of Fechmar", "Goreshovel", "The Chieftain", "Brainhew", "Humongous",
  "Coldkill", "Butcher's Pupil", "Islestrike", "Pompeii's Wrath", "Guardian Naga",
  "Warlord's Trust", "Spellsteel", "Stormrider", "Boneslayer Blade", "The Minotaur",
  "Razor's Edge", "Rune Master", "Cranebeak", "Death Cleaver", "Ethereal Edge",
  "Hellslayer", "Messerschmidt's Reaver", "Executioner's Justice",
  // Bows  "Pluckeye", "Witherstring", "Raven Claw", "Rogue's Bow", "Stormstrike",
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
].map(name => ({ name, category: "Unique", subcategory: "Weapon" }));

// ===== UNIQUE ARMOR =====
const UNIQUE_ARMOR: GameItem[] = [
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
  // Circlets / Coronets
  "Lore", "Radiance",
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
].map(name => ({ name, category: "Unique", subcategory: "Armor" }));

// ===== UNIQUE JEWELRY =====
const UNIQUE_JEWELRY: GameItem[] = [
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
].map(name => ({ name, category: "Unique", subcategory: "Jewelry" }));

// ===== UNIQUE GRIMOIRES (Warlock - RotW) =====
const UNIQUE_GRIMOIRES: GameItem[] = [
  "Measured Wrath", "Ars Tor'Baalos", "Ars Dul'Mephistos", "Ars Al'Diabolos",
].map(name => ({ name, category: "Unique", subcategory: "Grimoire" }));

// ===== UNIQUE JEWELS (Colossal Ancients - RotW) =====
const UNIQUE_JEWELS: GameItem[] = [
  "Defender's Fire", "Defender's Bile", "Protector's Frost",
  "Protector's Stone", "Guardian's Thunder", "Guardian's Light",
].map(name => ({ name, category: "Unique", subcategory: "Jewel" }));

// ===== SET ITEMS =====
const SET_ITEMS: GameItem[] = [
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
].map(name => ({ name, category: "Set", subcategory: "Set Item" }));

// ===== NOTABLE BASE ITEMS (Normal, Superior, Ethereal) =====
const BASE_ITEMS: GameItem[] = [
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
].map(name => ({ name, category: "Base", subcategory: "Base Item" }));

// ===== CHARMS =====
const CHARMS: GameItem[] = [
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
].map(name => ({ name, category: "Charm", subcategory: "Charm" }));

// ===== JEWELS =====
const JEWELS: GameItem[] = [
  // Magic Jewels (valuable mods)
  "Jewel 15% IAS", "Jewel 15% IAS / 40 ED", "Jewel 7% FHR / 15 All Res",
  "Jewel 5% FHR / 15 All Res", "Jewel 15 All Res", "Jewel 40 ED / 15 Max",
  "Jewel 40 ED / 15 Res", "Jewel -5/+5 Fire Facet (Die)", "Jewel -5/+5 Fire Facet (Level)",
  "Jewel -5/+5 Cold Facet (Die)", "Jewel -5/+5 Cold Facet (Level)",
  "Jewel -5/+5 Lightning Facet (Die)", "Jewel -5/+5 Lightning Facet (Level)",
  "Jewel -5/+5 Poison Facet (Die)", "Jewel -5/+5 Poison Facet (Level)",
  "Jewel 30% ED / 9 Max (Rare)",
  // RotW Colossal Ancient Unique Jewels (already in UNIQUE_JEWELS above)
].map(name => ({ name, category: "Jewel", subcategory: "Jewel" }));

// ===== COMBINE ALL =====
export const ALL_ITEMS: GameItem[] = [
  ...RUNES,
  ...RUNEWORDS,
  ...UNIQUE_WEAPONS,
  ...UNIQUE_ARMOR,
  ...UNIQUE_JEWELRY,
  ...UNIQUE_GRIMOIRES,
  ...UNIQUE_JEWELS,
  ...SET_ITEMS,
  ...BASE_ITEMS,
  ...CHARMS,
  ...JEWELS,
];

// Categories for filtering
export const ITEM_CATEGORIES = [
  "All",
  "Rune",
  "Runeword",
  "Unique",
  "Set",
  "Base",
  "Charm",
  "Jewel",
];
