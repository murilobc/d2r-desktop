# Overlay Editor Profiles Bugfix Design

## Overview

The Overlay Editor page has five interrelated bugs: (1) profile deserialization fails because the Rust `WidgetPlacement` struct uses `#[serde(rename = "type")]` for serialization but legacy stored JSON may contain `"widget_type"` instead of `"type"`, (2) profiles that fail to load remain in the database causing "name already in use" errors on re-creation, (3) the Widget Library allows dragging duplicates onto the canvas, (4) removing a widget requires selecting it first and using the Property Inspector panel with no direct on-canvas affordance, and (5) the editor preview canvas does not render the overlay controller buttons (Next/Split, Play/Pause, Stop, Screenshot Detect) that exist in the real overlay. The fix addresses all five with minimal, targeted changes.

## Glossary

- **Bug_Condition (C)**: The composite condition where any of the five defects manifests — legacy JSON deserialization fails, ghost profiles block creation, widget duplicates are allowed, removal is non-discoverable, or controller buttons are absent from the preview
- **Property (P)**: The desired behavior — profiles load correctly regardless of legacy JSON format, the UI reflects actual database state, each widget type can only be placed once, widgets can be removed directly from the canvas, and the preview canvas renders controller buttons
- **Preservation**: Existing behaviors that must remain unchanged — correct `"type"` JSON loads normally, new profile creation with unique names works, first-time widget placement works, Property Inspector removal still works, widget dragging continues to function, and the actual overlay window is unaffected
- **WidgetPlacement (Rust)**: The `WidgetPlacement` struct in `src-tauri/src/models.rs` with field `pub widget_type: String` decorated by `#[serde(rename = "type")]`
- **WidgetPlacement (TS)**: The TypeScript interface in `src/types.ts` with field `type: WidgetType`
- **PreviewCanvas**: The React component in `src/components/overlay-editor/PreviewCanvas.tsx` that renders the editor's visual canvas
- **OverlayRenderer**: The actual overlay window component in `src/overlay/OverlayRenderer.tsx` that displays controller buttons (split, pause, stop, item/detect)

## Bug Details

### Bug Condition

The bug manifests across five scenarios in the Overlay Editor page. The primary trigger is loading profiles from SQLite where `layout_json` was persisted before the `#[serde(rename = "type")]` attribute was added to the Rust struct — those rows contain `"widget_type"` in JSON, which the current deserializer rejects. The cascading bugs (duplicate name, duplicate widgets, no remove affordance, missing controller buttons) are independent code-level deficiencies.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type OverlayEditorAction
  OUTPUT: boolean
  
  // Bug 1: Deserialization failure
  IF input.action == "load_profiles" THEN
    RETURN EXISTS profile IN database WHERE
      profile.layout_json CONTAINS '"widget_type"'
      AND serde_json::from_str(profile.layout_json) RETURNS Error("missing field 'type'")
  END IF
  
  // Bug 2: Ghost profile blocks creation
  IF input.action == "create_profile" THEN
    RETURN input.name IN database_profile_names
      AND input.name NOT IN displayed_profile_names
  END IF
  
  // Bug 3: Duplicate widget placement
  IF input.action == "add_widget" THEN
    RETURN input.widget_type IN canvas.placed_widget_types
  END IF
  
  // Bug 4: No direct removal affordance
  IF input.action == "attempt_remove_widget" AND input.method == "canvas_direct" THEN
    RETURN NOT exists_canvas_remove_button(input.widget_id)
  END IF
  
  // Bug 5: Missing controller buttons in preview
  IF input.action == "render_preview" THEN
    RETURN NOT preview_canvas_contains_controller_buttons()
  END IF
  
  RETURN false
END FUNCTION
```

### Examples

- **Bug 1**: User opens Overlay Editor → Rust calls `serde_json::from_str` on stored JSON `{"widgets":[{"id":"abc","widget_type":"timer","x":10,"y":10,"size":"medium","opacity":1.0}],...}` → Error: "missing field 'type' at line 1 column 127" → empty profile list
- **Bug 2**: User sees empty profile list due to Bug 1, tries to create "Compact" profile → backend finds existing "Compact" row → returns "Profile name already in use" → user is stuck
- **Bug 3**: User drags "Session Timer" from Widget Library to canvas (timer widget placed) → drags "Session Timer" again → second timer widget appears → canvas has two identical timer widgets
- **Bug 4**: User wants to remove an overlapping widget → cannot click it to select → Property Inspector shows "Select a widget to edit its properties" → no way to remove it from canvas directly
- **Bug 5**: User designs overlay layout → preview shows widget positions but NOT the controller buttons (⏭ ⏸ ⏹ ◫) → user cannot predict how the actual overlay will look with controls present

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Profiles stored with correct `"type"` field in `layout_json` must continue to load normally
- Creating profiles with genuinely unique names must continue to work
- First-time placement of a widget type (not yet on canvas) from the Widget Library must continue to work
- The "Remove Widget" button in the Property Inspector must continue to function when a widget is selected
- Dragging widgets to reposition them on the canvas must continue to work
- Switching between profiles must continue to display the correct layout
- The actual overlay window (OverlayRenderer.tsx) must continue to render and function its controller buttons independently

**Scope:**
All inputs that do NOT involve legacy JSON deserialization, duplicate widget type placement, canvas removal, or controller button rendering should be completely unaffected by this fix. This includes:
- Normal profile CRUD operations with valid data
- Widget opacity and size changes
- Background color and opacity changes
- Canvas dimension changes
- Profile switching

## Hypothesized Root Cause

Based on the bug description and code analysis, the confirmed root causes are:

1. **Serde Rename vs. Legacy Data (Bug 1)**: The `WidgetPlacement` struct in `models.rs` has `#[serde(rename = "type")] pub widget_type: String`. When serializing, this correctly outputs `"type"` in JSON. However, if profiles were stored *before* this rename was added (when the field was just `pub widget_type` without rename), the stored JSON contains `"widget_type"` which fails deserialization. The `init_default_profiles` function creates data using the struct field name `widget_type` but the serde rename ensures it serializes as `"type"`. The issue is that any JSON created by a version without the rename attribute would have `"widget_type"` in storage.

2. **No Error Recovery on Load (Bug 2)**: The `get_overlay_profiles` command in `overlay_commands.rs` uses `serde_json::from_str(&layout_json).map_err(|e| e.to_string())?` which propagates the error and returns zero profiles. The profiles still exist in SQLite, so `create_overlay_profile` finds them during the uniqueness check.

3. **No Deduplication Guard (Bug 3)**: The `addWidget` function in `OverlayEditor.tsx` and the `handleDragEnd` handler unconditionally call `addWidget(data.type, ...)` without checking if that `WidgetType` is already present in `layout.widgets`. The `WidgetLibrary` shows a "Placed" badge but does not disable dragging.

4. **No On-Canvas Remove Affordance (Bug 4)**: The `DraggableWidget` component in `PreviewCanvas.tsx` renders only the widget text with click-to-select behavior. There is no delete button or keyboard shortcut rendered on/near the selected widget.

5. **Controller Buttons Not in Preview (Bug 5)**: The `PreviewCanvas.tsx` component only renders `layout.widgets` items. The actual overlay in `OverlayRenderer.tsx` has a `.overlay-controls` div with split (⏭), pause (⏸/▶), stop (⏹), and item (+) buttons. These controls are not represented anywhere in the editor preview. The `Overlay.tsx` also has a detect (◫) button. These need to appear as a static representation in the preview so users can see where they'll render.

## Correctness Properties

Property 1: Bug Condition - Legacy JSON Deserialization Recovery

_For any_ stored `layout_json` in the database where widgets use `"widget_type"` instead of `"type"` as the field name, the fixed `get_overlay_profiles` command SHALL successfully deserialize the profile by accepting both `"type"` and `"widget_type"` as valid field names, returning all profiles to the frontend.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Widget Deduplication

_For any_ attempt to add a widget type that is already placed on the canvas (via drag-and-drop from Widget Library), the fixed `addWidget`/`handleDragEnd` logic SHALL reject the placement and leave the canvas unchanged.

**Validates: Requirements 2.3**

Property 3: Bug Condition - On-Canvas Widget Removal

_For any_ widget that is selected on the preview canvas, the fixed `DraggableWidget` component SHALL display a visible delete affordance that, when activated, removes the widget from the layout.

**Validates: Requirements 2.4**

Property 4: Bug Condition - Controller Buttons in Preview

_For any_ rendered preview canvas with an active profile layout, the fixed `PreviewCanvas` component SHALL render a static representation of the overlay controller buttons (Next, Play/Pause, Stop, Screenshot Detect) at a designated position, giving the user a complete visual preview of the overlay layout.

**Validates: Requirements 2.5**

Property 5: Preservation - Existing Behavior Unchanged

_For any_ input where none of the bug conditions hold (correctly formatted JSON profiles, unique profile names, widget types not yet on canvas, widget removal via Property Inspector, and actual overlay window rendering), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `src-tauri/src/models.rs`

**Struct**: `WidgetPlacement`

**Specific Changes**:
1. **Add serde alias for backward compatibility**: Add `#[serde(alias = "widget_type")]` alongside the existing `#[serde(rename = "type")]` on the `widget_type` field. This tells serde to accept both `"type"` (primary) and `"widget_type"` (alias) during deserialization, while always serializing as `"type"`.
   ```rust
   #[serde(rename = "type", alias = "widget_type")]
   pub widget_type: String,
   ```

---

**File**: `src/pages/OverlayEditor.tsx`

**Function**: `addWidget` and `handleDragEnd`

**Specific Changes**:
2. **Guard against duplicate widget types**: In the `addWidget` callback, add an early return if `layout.widgets` already contains a widget with the same `type`. In `handleDragEnd`, check before calling `addWidget`.
   ```typescript
   const addWidget = useCallback(
     (type: WidgetType, x: number, y: number) => {
       if (!layout) return;
       // Prevent duplicate widget types
       if (layout.widgets.some((w) => w.type === type)) return;
       // ... rest of existing logic
     },
     [layout, updateLayout]
   );
   ```

---

**File**: `src/components/overlay-editor/WidgetLibrary.tsx`

**Component**: `DraggableWidgetItem`

**Specific Changes**:
3. **Disable dragging for already-placed widget types**: When `isPlaced` is true, pass `disabled: true` to the `useDraggable` hook to prevent the drag interaction entirely.
   ```typescript
   const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
     id: `widget-library-${type}`,
     data: { type, fromLibrary: true },
     disabled: isPlaced,
   });
   ```

---

**File**: `src/components/overlay-editor/PreviewCanvas.tsx`

**Component**: `DraggableWidget`

**Specific Changes**:
4. **Add delete button on selected widget**: When `isSelected` is true, render a small "×" delete button positioned at the top-right corner of the widget. This button calls a new `onRemoveWidget` prop passed through from `PreviewCanvas`.
   ```tsx
   {isSelected && (
     <button
       className="preview-canvas-widget-delete"
       onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}
       aria-label={`Remove ${widget.type} widget`}
     >
       ×
     </button>
   )}
   ```

5. **Add `onRemoveWidget` prop to PreviewCanvas**: The `PreviewCanvasProps` interface gains an `onRemoveWidget: (id: string) => void` callback. `OverlayEditor.tsx` passes the existing `removeWidget` function.

---

**File**: `src/components/overlay-editor/PreviewCanvas.tsx`

**Component**: `PreviewCanvas`

**Specific Changes**:
6. **Render static controller button representation**: Add a non-interactive overlay controls bar at the bottom of the preview canvas that shows the four controller button icons (⏭ ⏸ ⏹ ◫) with reduced opacity. These are purely visual placeholders to indicate where the buttons will appear in the actual overlay.
   ```tsx
   {/* Static controller button preview */}
   <div className="preview-canvas-controls" aria-label="Controller buttons preview">
     <span className="preview-ctrl-btn">⏭</span>
     <span className="preview-ctrl-btn">⏸</span>
     <span className="preview-ctrl-btn">⏹</span>
     <span className="preview-ctrl-btn">◫</span>
   </div>
   ```

---

**File**: `src/pages/OverlayEditor.tsx`

**Component**: `OverlayEditor`

**Specific Changes**:
7. **Pass `onRemoveWidget` to PreviewCanvas**: Wire the existing `removeWidget` callback to the new `onRemoveWidget` prop on `PreviewCanvas`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that exercise deserialization with legacy JSON, attempt duplicate widget placement, inspect the rendered canvas for removal affordances, and check for controller button elements. Run these tests on the UNFIXED code to observe failures and understand root cause.

**Test Cases**:
1. **Legacy JSON Deserialization Test**: Call `get_overlay_profiles` Tauri command (or simulate serde deserialization) with JSON containing `"widget_type"` field — will fail with "missing field 'type'" on unfixed code
2. **Duplicate Widget Placement Test**: Call `addWidget("timer", 50, 50)` when a timer widget is already on canvas — will succeed (adding duplicate) on unfixed code
3. **Canvas Remove Button Test**: Render `PreviewCanvas` with a selected widget, query for delete affordance — will find none on unfixed code
4. **Controller Buttons in Preview Test**: Render `PreviewCanvas` with a layout, query for controller button elements — will find none on unfixed code

**Expected Counterexamples**:
- Serde deserialization returns error for legacy `"widget_type"` JSON
- `layout.widgets` array grows with duplicate types when `addWidget` is called multiple times with same type
- DOM queries for delete buttons on canvas widgets return empty
- DOM queries for controller buttons in preview return empty

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

Specifically:
- For all JSON strings containing `"widget_type"` as field name → deserialization succeeds
- For all `addWidget(type, x, y)` calls where type is already placed → widget count does not increase
- For all selected widgets on canvas → delete button is rendered and functional
- For all rendered previews → controller buttons are visible

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for valid profile operations, widget interactions, and Property Inspector usage, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Valid JSON Deserialization Preservation**: Verify that profiles with `"type"` field continue to load identically after the fix
2. **Unique Profile Creation Preservation**: Verify that creating profiles with unique names continues to succeed
3. **First Widget Placement Preservation**: Verify that placing a widget type not yet on canvas continues to work
4. **Property Inspector Remove Preservation**: Verify that removing via Property Inspector continues to function
5. **Widget Drag Preservation**: Verify that repositioning widgets on canvas continues to work

### Unit Tests

- Test serde deserialization of `WidgetPlacement` with `"type"` field (existing behavior)
- Test serde deserialization of `WidgetPlacement` with `"widget_type"` field (legacy fix)
- Test serde serialization always produces `"type"` field (no regression)
- Test `addWidget` rejection when widget type is already placed
- Test `addWidget` acceptance when widget type is not yet placed
- Test delete button renders on selected `DraggableWidget`
- Test delete button does not render on unselected `DraggableWidget`
- Test controller buttons render in `PreviewCanvas`
- Test `useDraggable` disabled state in `WidgetLibrary` when `isPlaced` is true

### Property-Based Tests

- Generate random `WidgetPlacement` JSON objects with randomly chosen field name (`"type"` or `"widget_type"`) and verify deserialization always succeeds
- Generate random sequences of `addWidget` calls with random widget types and verify no duplicate types exist in the final widget array
- Generate random widget layouts and verify PreviewCanvas always renders exactly one delete button per selected widget
- Generate random valid profile layouts and verify they round-trip through serialize/deserialize unchanged

### Integration Tests

- Test full overlay editor flow: load profiles with legacy JSON → profiles appear in list → create new profile succeeds
- Test widget deduplication end-to-end: drag widget → see "Placed" badge → attempt re-drag → canvas unchanged
- Test widget removal from canvas: select widget → click delete button on widget → widget removed from layout
- Test controller buttons visibility: load editor → see ⏭ ⏸ ⏹ ◫ in preview canvas
- Test that actual overlay window (OverlayRenderer) is unaffected by preview changes
