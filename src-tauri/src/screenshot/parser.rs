/// Known rarity labels that appear on separate lines in D2R tooltips.
const RARITY_LABELS: &[&str] = &["Unique", "Set", "Rare", "Magic", "Crafted"];

/// A parsed candidate extracted from tooltip text.
#[derive(Debug, Clone)]
pub struct ParsedCandidate {
    pub text: String,
    pub line_index: usize,
}

/// Normalizes extracted text for matching:
/// 1. Trim leading/trailing whitespace
/// 2. Replace line breaks with spaces
/// 3. Strip characters not in [A-Za-z0-9 \-']
/// 4. Collapse multiple consecutive spaces into one
/// 5. Trim again
pub fn normalize_text(text: &str) -> String {
    // Step 1: trim
    let trimmed = text.trim();

    // Step 2: replace line breaks with spaces
    let no_breaks = trimmed
        .replace("\r\n", " ")
        .replace('\r', " ")
        .replace('\n', " ");

    // Step 3: strip characters not matching [A-Za-z0-9 \-']
    let filtered: String = no_breaks
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-' || *c == '\'')
        .collect();

    // Step 4: collapse multiple consecutive spaces into one
    let mut collapsed = String::with_capacity(filtered.len());
    let mut prev_space = false;
    for ch in filtered.chars() {
        if ch == ' ' {
            if !prev_space {
                collapsed.push(' ');
            }
            prev_space = true;
        } else {
            collapsed.push(ch);
            prev_space = false;
        }
    }

    // Step 5: trim again
    collapsed.trim().to_string()
}

/// Strips a known rarity label prefix from the beginning of text.
/// Returns the text with the label removed, or the original text if no label is found.
fn strip_rarity_prefix(text: &str) -> String {
    for label in RARITY_LABELS {
        let prefix = format!("{} ", label);
        if text.starts_with(&prefix) {
            return text[prefix.len()..].to_string();
        }
    }
    text.to_string()
}

/// Returns true if the given text is exactly a known rarity label (case-sensitive).
fn is_rarity_label(text: &str) -> bool {
    RARITY_LABELS.contains(&text)
}

/// Parses raw OCR tooltip text into candidate item names.
///
/// Strategy:
/// 1. Split by newlines, filter empty lines
/// 2. Skip lines that are only a rarity label
/// 3. First non-label line (normalized) → primary candidate (line_index=0)
/// 4. If 2+ non-label lines exist, concatenate first two (normalized) → secondary candidate (line_index=1)
/// 5. Strip rarity label prefixes from all candidates
pub fn parse_tooltip_text(raw_text: &str) -> Vec<ParsedCandidate> {
    // Split by newlines and collect non-empty, non-label lines
    let lines: Vec<&str> = raw_text
        .split('\n')
        .map(|l| l.trim_matches('\r').trim())
        .filter(|l| !l.is_empty())
        .collect();

    if lines.is_empty() {
        return Vec::new();
    }

    // Separate content lines from pure rarity-label lines
    let content_lines: Vec<&str> = lines
        .iter()
        .filter(|l| !is_rarity_label(l))
        .copied()
        .collect();

    if content_lines.is_empty() {
        return Vec::new();
    }

    let mut candidates = Vec::new();

    // Primary candidate: first content line, normalized, with rarity prefix stripped
    let primary_normalized = normalize_text(content_lines[0]);
    if !primary_normalized.is_empty() {
        let primary_stripped = strip_rarity_prefix(&primary_normalized);
        if !primary_stripped.is_empty() {
            candidates.push(ParsedCandidate {
                text: primary_stripped,
                line_index: 0,
            });
        }
    }

    // Secondary candidate: first two content lines concatenated, if available
    if content_lines.len() >= 2 {
        let first = normalize_text(content_lines[0]);
        let second = normalize_text(content_lines[1]);
        let concatenated = format!("{} {}", first, second);
        let secondary_normalized = normalize_text(&concatenated);
        if !secondary_normalized.is_empty() {
            let secondary_stripped = strip_rarity_prefix(&secondary_normalized);
            if !secondary_stripped.is_empty() {
                candidates.push(ParsedCandidate {
                    text: secondary_stripped,
                    line_index: 1,
                });
            }
        }
    }

    candidates
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- normalize_text tests ---

    #[test]
    fn normalize_text_trims_whitespace() {
        assert_eq!(normalize_text("  hello  "), "hello");
    }

    #[test]
    fn normalize_text_collapses_spaces() {
        assert_eq!(normalize_text("hello   world"), "hello world");
    }

    #[test]
    fn normalize_text_removes_line_breaks() {
        assert_eq!(normalize_text("hello\nworld"), "hello world");
        assert_eq!(normalize_text("hello\r\nworld"), "hello world");
        assert_eq!(normalize_text("hello\rworld"), "hello world");
    }

    #[test]
    fn normalize_text_strips_invalid_chars() {
        assert_eq!(normalize_text("Harlequin Crest!@#$"), "Harlequin Crest");
        assert_eq!(normalize_text("Bul-Kathos' Wedding Band"), "Bul-Kathos' Wedding Band");
    }

    #[test]
    fn normalize_text_preserves_hyphens_and_apostrophes() {
        assert_eq!(normalize_text("Tal Rasha's"), "Tal Rasha's");
        assert_eq!(normalize_text("Bul-Kathos"), "Bul-Kathos");
    }

    #[test]
    fn normalize_text_empty_input() {
        assert_eq!(normalize_text(""), "");
        assert_eq!(normalize_text("   "), "");
    }

    #[test]
    fn normalize_text_only_special_chars() {
        assert_eq!(normalize_text("!@#$%^&*()"), "");
    }

    // --- parse_tooltip_text tests ---

    #[test]
    fn parse_empty_input() {
        let result = parse_tooltip_text("");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_whitespace_only_input() {
        let result = parse_tooltip_text("   \n  \n  ");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_single_line_item() {
        let result = parse_tooltip_text("Harlequin Crest");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Harlequin Crest");
        assert_eq!(result[0].line_index, 0);
    }

    #[test]
    fn parse_multi_line_produces_two_candidates() {
        let result = parse_tooltip_text("Harlequin Crest\nShako");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Harlequin Crest");
        assert_eq!(result[0].line_index, 0);
        assert_eq!(result[1].text, "Harlequin Crest Shako");
        assert_eq!(result[1].line_index, 1);
    }

    #[test]
    fn parse_strips_rarity_label_prefix() {
        let result = parse_tooltip_text("Unique Harlequin Crest");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Harlequin Crest");
    }

    #[test]
    fn parse_strips_rarity_label_on_separate_line() {
        let result = parse_tooltip_text("Unique\nHarlequin Crest");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Harlequin Crest");
        assert_eq!(result[0].line_index, 0);
    }

    #[test]
    fn parse_strips_set_label() {
        let result = parse_tooltip_text("Set Tal Rasha's Horadric Crest");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Tal Rasha's Horadric Crest");
    }

    #[test]
    fn parse_handles_multiword_item_names() {
        let result = parse_tooltip_text("Chains of Honor");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Chains of Honor");
    }

    #[test]
    fn parse_handles_special_characters_in_names() {
        let result = parse_tooltip_text("Bul-Kathos' Wedding Band");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Bul-Kathos' Wedding Band");
    }

    #[test]
    fn parse_rarity_only_lines_excluded() {
        // If all lines are rarity labels, no candidates
        let result = parse_tooltip_text("Unique\nSet\nRare");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_multiple_rarity_labels_before_item() {
        let result = parse_tooltip_text("Unique\nRare\nHarlequin Crest\nShako");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Harlequin Crest");
        assert_eq!(result[1].text, "Harlequin Crest Shako");
    }

    #[test]
    fn parse_crafted_label_stripped() {
        let result = parse_tooltip_text("Crafted Blood Gloves");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Blood Gloves");
    }

    #[test]
    fn parse_magic_label_stripped() {
        let result = parse_tooltip_text("Magic\nGrand Charm");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "Grand Charm");
    }

    // --- Property-Based Tests ---
    // Feature: screenshot-item-detection, Property 5: Text normalization produces valid canonical output

    use proptest::prelude::*;

    proptest! {
        /// **Validates: Requirements 12.4**
        #[test]
        fn prop_normalize_text_valid_output(input in "\\PC*") {
            let output = normalize_text(&input);

            // No leading whitespace
            prop_assert_eq!(&output, output.trim_start(), "Output has leading whitespace");

            // No trailing whitespace
            prop_assert_eq!(&output, output.trim_end(), "Output has trailing whitespace");

            // No consecutive spaces
            prop_assert!(!output.contains("  "), "Output contains consecutive spaces");

            // No line break characters
            prop_assert!(!output.contains('\n'), "Output contains newline");
            prop_assert!(!output.contains('\r'), "Output contains carriage return");

            // Only valid characters [A-Za-z0-9 \-']
            for ch in output.chars() {
                prop_assert!(
                    ch.is_ascii_alphanumeric() || ch == ' ' || ch == '-' || ch == '\'',
                    "Invalid character: {:?}", ch
                );
            }
        }
    }

    // Feature: screenshot-item-detection, Property 9: Tooltip parser first-line extraction

    proptest! {
        /// **Validates: Requirements 12.1**
        #[test]
        fn prop_first_line_extraction(
            line1 in "[A-Za-z][A-Za-z0-9 '-]{0,30}",
            line2 in "[A-Za-z][A-Za-z0-9 '-]{0,30}",
        ) {
            // Ensure lines aren't rarity labels
            prop_assume!(!is_rarity_label(line1.trim()));
            prop_assume!(!is_rarity_label(line2.trim()));
            prop_assume!(!line1.trim().is_empty());
            prop_assume!(!line2.trim().is_empty());

            let input = format!("{}\n{}", line1, line2);
            let candidates = parse_tooltip_text(&input);

            // Should have at least 1 candidate (primary from first line)
            prop_assert!(!candidates.is_empty());

            // First candidate should be normalized first line (with rarity prefix stripped)
            let expected_first = normalize_text(&line1);
            let first_stripped = strip_rarity_prefix(&expected_first);
            if !first_stripped.is_empty() {
                prop_assert_eq!(&candidates[0].text, &first_stripped);
            }

            // Should have second candidate (concatenation of first two lines)
            if candidates.len() >= 2 {
                let concat = format!("{} {}", normalize_text(&line1), normalize_text(&line2));
                let expected_second = strip_rarity_prefix(&normalize_text(&concat));
                prop_assert_eq!(&candidates[1].text, &expected_second);
            }
        }
    }

    // Feature: screenshot-item-detection, Property 10: Label stripping from tooltip candidates

    proptest! {
        /// **Validates: Requirements 12.2**
        #[test]
        fn prop_label_stripping(
            item_name in "[A-Za-z][A-Za-z0-9 '-]{1,30}",
            label_idx in 0usize..5usize,
        ) {
            let labels = ["Unique", "Set", "Rare", "Magic", "Crafted"];
            let label = labels[label_idx];

            // Ensure item_name isn't itself a rarity label
            prop_assume!(!is_rarity_label(item_name.trim()));
            prop_assume!(!item_name.trim().is_empty());

            // Test 1: Label as prefix on same line
            let input_prefix = format!("{} {}", label, item_name);
            let candidates_prefix = parse_tooltip_text(&input_prefix);
            for candidate in &candidates_prefix {
                prop_assert!(
                    !candidate.text.starts_with(&format!("{} ", label)),
                    "Candidate '{}' should not start with label '{}'", candidate.text, label
                );
            }

            // Test 2: Label on separate line
            let input_separate = format!("{}\n{}", label, item_name);
            let candidates_separate = parse_tooltip_text(&input_separate);
            for candidate in &candidates_separate {
                // The label-only line should not appear as a candidate
                prop_assert_ne!(&candidate.text, label);
                // And the candidate should not have the label as prefix
                prop_assert!(
                    !candidate.text.starts_with(&format!("{} ", label)),
                    "Candidate '{}' should not start with label '{}'", candidate.text, label
                );
            }
        }
    }
}
