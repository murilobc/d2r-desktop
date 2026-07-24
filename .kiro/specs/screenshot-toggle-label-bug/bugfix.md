# Bugfix Requirements Document

## Introduction

The toggle buttons in the Screenshot Detection settings page display overlapping text ("ONF") when switching from OFF to ON state. This occurs because the `pulse` CSS animation (applied via the `recording` class) starts animating opacity on the same frame that React updates the button's text content. The browser compositor briefly renders both the old text ("OFF") and new text ("ON") simultaneously, producing a visible "ONF" artifact. The "Clipboard Monitoring" toggle is affected; the "Auto-Detection" toggle shows the same defect but may appear correct if it starts in the ON state on page load.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Clipboard Monitoring toggle is switched from OFF to ON THEN the system displays "ONF" (overlapping "ON" and "OFF" text) due to the `pulse` opacity animation starting simultaneously with the text content change

1.2 WHEN any toggle button with the `recording` class receives the `pulse` animation while text content changes THEN the system renders both old and new text content in the same frame, creating a visual overlap artifact

### Expected Behavior (Correct)

2.1 WHEN the Clipboard Monitoring toggle is switched from OFF to ON THEN the system SHALL display only "ON" in the success color with no overlapping or residual text from the previous state

2.2 WHEN any toggle button changes state THEN the system SHALL render only the current state's label text ("ON" or "OFF") at all times, with no intermediate frame showing both labels simultaneously

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Auto-Detection toggle is in the ON state THEN the system SHALL CONTINUE TO display "ON" in the success color with the recording visual style

3.2 WHEN any toggle is in the OFF state THEN the system SHALL CONTINUE TO display "OFF" in the default text color without the pulse animation

3.3 WHEN the confidence threshold input is changed THEN the system SHALL CONTINUE TO validate and persist the value correctly

3.4 WHEN toggle buttons are clicked THEN the system SHALL CONTINUE TO persist the setting via the backend API and reflect the updated state
