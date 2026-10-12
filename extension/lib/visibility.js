// Which monitors' desktops cannot be seen: a maximised or full-screen
// window hides everything beneath it.
//
// windows: [{monitor, covers, minimized, onActiveWorkspace}]
export function coveredMonitors(windows) {
    const covered = new Set();
    for (const window of windows) {
        if (window.covers && !window.minimized && window.onActiveWorkspace)
            covered.add(window.monitor);
    }
    return covered;
}
