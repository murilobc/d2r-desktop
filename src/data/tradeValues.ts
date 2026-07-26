export type TradeValueCategory = "HR+" | "Mid" | "Low" | "Self-use";

export interface TradeValueEntry {
  category: TradeValueCategory;
}

// Format: "Values based on diablo2.io price data as of YYYY-MM-DD"
export const SOURCE_ATTRIBUTION: string =
  "Values based on diablo2.io price data as of 2025-07-01";

export const TRADE_VALUES: Record<string, TradeValueEntry> = {
  // HR+ runewords
  "Enigma":          { category: "HR+" },
  "Infinity":        { category: "HR+" },
  "Fortitude":       { category: "HR+" },
  "Call to Arms":    { category: "HR+" },
  "Chains of Honor": { category: "HR+" },
  "Last Wish":       { category: "HR+" },
  "Faith":           { category: "HR+" },
  "Grief":           { category: "HR+" },
  "Phoenix":         { category: "HR+" },
  "Dream":           { category: "HR+" },
  "Ice":             { category: "HR+" },
  "Brand":           { category: "HR+" },
  // HR+ unique items / jewelry
  "Harlequin Crest":     { category: "HR+" },
  "Arachnid Mesh":       { category: "HR+" },
  "Stone of Jordan":     { category: "HR+" },
  "Tyrael's Might":      { category: "HR+" },
  "Griffon's Eye":       { category: "HR+" },
  "Death's Fathom":      { category: "HR+" },
  "Death's Web":         { category: "HR+" },
  "Windforce":           { category: "HR+" },
  "Nightwing's Veil":    { category: "HR+" },
  "Mara's Kaleidoscope": { category: "HR+" },
  // HR+ runes
  "Ber Rune":  { category: "HR+" },
  "Jah Rune":  { category: "HR+" },
  "Cham Rune": { category: "HR+" },
  "Zod Rune":  { category: "HR+" },
  "Sur Rune":  { category: "HR+" },
  // HR+ charms / jewels
  "Annihilus":                       { category: "HR+" },
  "Hellfire Torch":                  { category: "HR+" },
  "Small Charm 3 Max/20 AR/20 Life": { category: "HR+" },
  "Jewel 15% IAS / 40 ED":           { category: "HR+" },
  // Mid runewords
  "Heart of the Oak": { category: "Mid" },
  "Exile":            { category: "Mid" },
  "Doom":             { category: "Mid" },
  "Death":            { category: "Mid" },
  "Dragon":           { category: "Mid" },
  "Pride":            { category: "Mid" },
  "Famine":           { category: "Mid" },
  "Plague":           { category: "Mid" },
  // Mid unique items
  "The Oculus":               { category: "Mid" },
  "Andariel's Visage":        { category: "Mid" },
  "War Traveler":             { category: "Mid" },
  "Highlord's Wrath":         { category: "Mid" },
  "Verdungo's Hearty Cord":   { category: "Mid" },
  "Arreat's Face":            { category: "Mid" },
  "Raven Frost":              { category: "Mid" },
  "Wisp Projector":           { category: "Mid" },
  "Sandstorm Trek":           { category: "Mid" },
  "Dracul's Grasp":           { category: "Mid" },
  "String of Ears":           { category: "Mid" },
  "Herald of Zakarum":        { category: "Mid" },
  "Shadow Dancer":            { category: "Mid" },
  "Bul-Kathos' Wedding Band": { category: "Mid" },
  "Nosferatu's Coil":         { category: "Mid" },
  "Eschuta's Temper":         { category: "Mid" },
  "Kira's Guardian":          { category: "Mid" },
  // Mid runes
  "Ohm Rune": { category: "Mid" },
  "Lo Rune":  { category: "Mid" },
  "Vex Rune": { category: "Mid" },
  "Gul Rune": { category: "Mid" },
  // Mid charms / jewels
  "Gheed's Fortune":                       { category: "Mid" },
  "Black Cleft (Magic Sunder)":            { category: "Mid" },
  "Bone Break (Physical Sunder)":          { category: "Mid" },
  "Cold Rupture (Cold Sunder)":            { category: "Mid" },
  "Crack of the Heavens (Lightning Sunder)": { category: "Mid" },
  "Flame Rift (Fire Sunder)":              { category: "Mid" },
  "Rotting Fissure (Poison Sunder)":       { category: "Mid" },
  "Jewel -5/+5 Fire Facet (Die)":          { category: "Mid" },
  "Jewel -5/+5 Lightning Facet (Die)":     { category: "Mid" },
  "Jewel -5/+5 Cold Facet (Die)":          { category: "Mid" },
  "Jewel 40 ED / 15 Max":                  { category: "Mid" },
  // Low runewords
  "Spirit":    { category: "Low" },
  "Insight":   { category: "Low" },
  "Treachery": { category: "Low" },
  "Obedience": { category: "Low" },
  "Mosaic":    { category: "Low" },
  "Chaos":     { category: "Low" },
  "Hustle":    { category: "Low" },
  // Low unique items
  "Skin of the Vipermagi": { category: "Low" },
  "Magefist":              { category: "Low" },
  "Chance Guards":         { category: "Low" },
  "Vampire Gaze":          { category: "Low" },
  "Stormshield":           { category: "Low" },
  "Skullder's Ire":        { category: "Low" },
  "Gore Rider":            { category: "Low" },
  "Shaftstop":             { category: "Low" },
  "Jalal's Mane":          { category: "Low" },
  "Thundergod's Vigor":    { category: "Low" },
  "Homunculus":            { category: "Low" },
  "Titan's Revenge":       { category: "Low" },
  "Thunderstroke":         { category: "Low" },
  "Goldwrap":              { category: "Low" },
  // Low runes
  "Ist Rune": { category: "Low" },
  "Mal Rune": { category: "Low" },
  "Um Rune":  { category: "Low" },
  "Pul Rune": { category: "Low" },
  // Self-use items (personal gameplay value, low universal trade demand)
  "Peasant Crown":  { category: "Self-use" },
  "Frostburn":      { category: "Self-use" },
  "Razortail":      { category: "Self-use" },
  "Waterwalk":      { category: "Self-use" },
  "Silkweave":      { category: "Self-use" },
  "Guardian Angel": { category: "Self-use" },
  "Rockstopper":    { category: "Self-use" },
  "Infernostride":  { category: "Self-use" },
};

export function getTradeValue(itemName: string): TradeValueEntry | null {
  if (!Object.prototype.hasOwnProperty.call(TRADE_VALUES, itemName)) return null;
  return TRADE_VALUES[itemName];
}
