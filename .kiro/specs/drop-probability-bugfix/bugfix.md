# Bugfix Requirements Document

## Introduction

The Drop Calculator's Probability tab has a severely incomplete data set that makes the feature appear broken for all monsters except Baal. The `tc_data.json` file contains only 3 monsters, 8 items, and 6 treasure classes — a bare-bones skeleton that only produces meaningful results for Baal (the highest TC monster). Additionally, the frontend hardcodes tiny MONSTERS and ITEMS arrays with no filtering, search, or area-based calculation support. This renders the Probability tab largely non-functional for real-world farming analysis.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects Mephisto and any item from the dropdown THEN the system shows "This item cannot drop from this monster" for items that Mephisto CAN legitimately drop (e.g., Oculus, Arachnid Mesh, Vampire Gaze, Harlequin Crest, and many others) because the TC data only contains a few items placed in higher TCs that Mephisto's TC78 cannot reach

1.2 WHEN a user selects Andariel and any item other than Stone of Jordan or Vampire Gaze THEN the system shows "This item cannot drop from this monster" because TC69 only has SoJ directly and TC75 only has Vampire Gaze in the current data, despite Andariel being able to drop many more items in reality

1.3 WHEN a user wants to calculate drop chances for commonly farmed monsters (Diablo, Duriel, Pindleskin, Nihlathak, Council Members, Countess, etc.) THEN the system provides no option for these monsters because MONSTERS only contains 3 entries (Mephisto, Baal, Andariel)

1.4 WHEN a user wants to calculate drop chances for common valuable items (Enigma runes, Infinity bases, Griffon's Eye, Death's Fathom, etc.) THEN the system provides no option for these items because ITEMS only contains 7 entries

1.5 WHEN a user wants to know the aggregate probability of finding an item while farming an area like Chaos Sanctuary or Ancient Tunnels (considering all monsters in that area) THEN the system has no area-based calculation mode and the user must manually check individual monsters

1.6 WHEN a user wants to find a specific item in the item dropdown THEN the system provides no search/filter functionality, requiring manual scrolling through the list

### Expected Behavior (Correct)

2.1 WHEN a user selects any monster and an item that monster can legitimately drop (based on TC hierarchy and qlvl rules) THEN the system SHALL calculate and display the correct drop probability with accurate 1-in-X odds and kill thresholds

2.2 WHEN a user selects Andariel, Mephisto, or any other monster THEN the system SHALL correctly resolve all items reachable through that monster's TC chain, returning probability > 0 for items within that TC's range and 0 only for items genuinely unreachable

2.3 WHEN a user opens the monster dropdown THEN the system SHALL display all act bosses (Andariel, Duriel, Mephisto, Diablo, Baal), super uniques (Pindleskin, Nihlathak, Eldritch, Shenk, Thresh Socket, etc.), and other commonly farmed monsters with their TC data populated in tc_data.json

2.4 WHEN a user opens the item dropdown THEN the system SHALL display a comprehensive list of valuable/sought-after items including all popular unique items, set items, high runes (Ber, Jah, Lo, Sur, Ohm, Vex, etc.), and key bases

2.5 WHEN a user wants to calculate area-based probabilities THEN the system SHALL provide an area selection mode that aggregates drop probabilities across all monster types in that area (normal monsters, champions, unique packs) to show per-run drop chance

2.6 WHEN a user wants to find a specific item THEN the system SHALL provide filter controls (by rarity: Unique, Set, Rune, etc.) and/or a text search input to quickly locate items in the dropdown

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user selects Baal and any currently-listed item THEN the system SHALL CONTINUE TO calculate correct probabilities with the same TC tree traversal algorithm, MF application, player count adjustment, quest bonus, terror zone, and herald tier modifiers

3.2 WHEN a user adjusts Magic Find, player count, quest bonus, terror zone, or herald tier settings THEN the system SHALL CONTINUE TO correctly apply these modifiers to the calculated probability using the existing formulas (diminishing returns for MF, NoDrop reduction for players, doubled rolls for quest bonus)

3.3 WHEN a probability result is displayed THEN the system SHALL CONTINUE TO show the distribution chart, kill thresholds (50%/63%/90%/99%), effective MF, and run estimates based on historical data

3.4 WHEN the probability engine encounters an invalid monster ID, item ID, or circular TC reference THEN the system SHALL CONTINUE TO return appropriate error messages rather than crashing
