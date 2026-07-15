# Bugfix Requirements Document

## Introduction

The Widget Mode feature is non-functional. It renders only a "D2R" logo when idle and shows only run count and session time when active — providing no configurable stats, no useful idle information, and no differentiation from the overlay. Additionally, on Linux tiling compositors the widget window ignores its configured 200x50px dimensions. The README promises a configurable, ultra-compact stats display but the implementation is a bare-bones stub.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN no session is active (idle state) THEN the widget renders only the text "D2R" with no useful information (no total runs, no last session time, no profile name)

1.2 WHEN a session is active THEN the widget displays only session run count and session elapsed time, ignoring all other available stats (run timer, area, total runs, fastest time, average time)

1.3 WHEN a session is active THEN the widget provides no mechanism for the user to choose which stats are displayed

1.4 WHEN the widget is running on a Linux tiling compositor (Hyprland, Niri, etc.) THEN the window ignores its configured 200x50px dimensions and renders at the compositor's default tiled size because no window rules are documented for the widget window

### Expected Behavior (Correct)

2.1 WHEN no session is active (idle state) THEN the system SHALL display useful summary information including the active profile name and total all-time run count

2.2 WHEN a session is active THEN the system SHALL display a configurable selection of 2-3 stats from the available set (run count, session time, run timer, area, fastest time, average time, total runs)

2.3 WHEN a session is active THEN the system SHALL allow the user to configure which stats are shown in the widget via a settings mechanism (e.g., a widget settings section in the Settings page or a right-click context menu on the widget)

2.4 WHEN the widget is running on a Linux tiling compositor THEN the README SHALL document the required window rules for the widget window (title "D2R Widget") so it floats at its intended 200x50px size, analogous to the existing overlay documentation

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the widget window is opened THEN the system SHALL CONTINUE TO use the existing window configuration (200x50px, frameless, transparent, always-on-top, skip-taskbar, initially hidden)

3.2 WHEN the widget is displayed THEN the system SHALL CONTINUE TO allow dragging the widget to reposition it on screen

3.3 WHEN the widget is active during a session THEN the system SHALL CONTINUE TO receive real-time state updates via the existing `overlay-state-update` event from the RunTracker

3.4 WHEN the overlay is also open THEN the system SHALL CONTINUE TO operate the widget independently — both can be used simultaneously without conflict

3.5 WHEN the user switches between dark and light themes THEN the widget SHALL CONTINUE TO apply the appropriate theme styling
