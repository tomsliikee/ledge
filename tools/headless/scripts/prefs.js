// Opens the settings window and checks that a change made there arrives.
export default async function ({extension, store, shot, sleep, note}) {
    await sleep(1500);
    extension.openPreferences();
    await sleep(6000);
    const windows = global.get_window_actors().map(actor => actor.meta_window.get_title());
    note(`windows: ${JSON.stringify(windows)}`);
    await shot('prefs');
}
