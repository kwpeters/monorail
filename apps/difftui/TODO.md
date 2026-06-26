# TODO

- DONE — Refactored to a master-detail view: the file list (master) sits beside
  a detail pane (right) that reactively shows the actions for the current
  selection — no Enter required.  `x` toggles multi-selection of files (the
  detail pane then shows the actions common to all selected files).  The first
  10 actions are numbered 1–9 then 0; pressing the number runs that action
  (destructive actions confirm first).  Tab focuses the action pane to scroll
  when there are more than 10 actions.

- DONE — Added `**/*.tsbuildinfo` to the default list of exclude patterns.

- DONE — The settings view now shows the absolute paths of the left and right
  directories (read-only) and provides a `w` command to swap them.
