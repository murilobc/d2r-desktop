---
inclusion: always
---

# Rust Code Conventions

## Doc Comments vs Regular Comments

**NEVER use doc comments (`///`) immediately before macro invocations** (e.g., `proptest!`, `macro_rules!`, `lazy_static!`). Doc comments are attributes (`#[doc = "..."]`) that attach to the following item, but macros do not propagate these attributes to the items they generate. This produces `unused_doc_comments` warnings.

**Rule:** Use regular comments (`//`) for any text that precedes a macro invocation. Reserve `///` exclusively for items that the compiler recognizes as documentable: `fn`, `struct`, `enum`, `trait`, `impl`, `mod`, `const`, `static`, `type`.

```rust
// WRONG — produces warning:
/// Validates requirement 1.1
proptest! { ... }

// CORRECT:
// Validates requirement 1.1
proptest! { ... }
```

Note: Doc comments (`///`) placed **inside** a `proptest!` block directly above a `#[test] fn` are also invalid for the same reason — use `//` there too.

## Warnings Policy

All Rust code must compile with **zero warnings**. After writing or modifying Rust code, always verify with `cargo check` (or `cargo clippy` when available) before considering the work complete.
