// What widgets there are. Kept apart from how they are drawn, because the
// settings window runs outside the shell and cannot load the drawing code.
//
// sizes: the first is the one a new widget gets. defaults: its options.
// multiple: more than one of it makes sense. bare: its content fills the
// tile to the edge. tone: the tone of the scheme its tile and marks take in
// the expressive look; without one the tile stays neutral and only its
// marks carry colour. opens: the apps a click on it opens, the first that
// is installed; "player" stands for the app that plays the music.

const entry = (title, about, sizes, rest = {}) => ({title, about, sizes, defaults: {}, multiple: false, bare: false, tone: null, opens: [], ...rest});

const ALL = ['small', 'medium', 'large'];
const COMPACT = ['small', 'medium'];
const WIDE = ['medium', 'large'];

const MONITOR = ['net.nokyan.Resources', 'org.gnome.SystemMonitor'];
const CLOCKS = ['org.gnome.clocks'];

export const catalog = {
    clock: entry('Clock', 'The time as a clock face or in figures, with the date.', ALL,
        {defaults: {face: 'analog'}, multiple: true, tone: 'primary', opens: CLOCKS}),
    weather: entry('Weather', 'The weather at one place, from Open-Meteo.', ['medium', 'small', 'large'], {tone: 'secondary', opens: ['org.gnome.Weather']}),
    system: entry('Performance', 'Processor, graphics card, memory and temperature together.', WIDE, {opens: MONITOR}),
    cpu: entry('CPU', 'How busy the processor is.', COMPACT, {opens: MONITOR}),
    gpu: entry('GPU', 'How busy the graphics card is. On Intel graphics its clock frequency stands in.', COMPACT, {opens: MONITOR}),
    memory: entry('Memory', 'How much of the memory is in use.', COMPACT, {opens: MONITOR}),
    temperature: entry('Temperature', 'The temperature of the processor.', COMPACT, {opens: MONITOR}),
    calendar: entry('Calendar', 'Today\'s date and the sheet of the month.', ALL, {tone: 'tertiary', opens: ['org.gnome.Calendar']}),
    events: entry('Up next', 'What the calendar holds for the coming week, as far as the shell has loaded it.', WIDE,
        {tone: 'secondary', opens: ['org.gnome.Calendar']}),
    battery: entry('Battery', 'Charge and time left. Stays away on a machine without a battery.', COMPACT, {tone: 'secondary', opens: ['gnome-power-panel']}),
    network: entry('Network', 'Download and upload per second, over all real network interfaces.', COMPACT, {opens: MONITOR}),
    disk: entry('Storage', 'How full the disks are.', COMPACT, {tone: 'tertiary', opens: ['org.gnome.baobab']}),
    media: entry('Now playing', 'The song a player is playing, with its controls.', ['medium', 'small', 'large'], {tone: 'tertiary', opens: ['player']}),
    claude: entry('Tally', 'The session and week limits of your plan, as the Tally extension recorded them. Asks nothing itself.', ['medium', 'small'], {tone: 'primary'}),
    worldclock: entry('World clock', 'The time in other cities, and how far ahead or behind they are.', ['medium', 'small', 'large'],
        {defaults: {cities: []}, opens: CLOCKS}),
    timer: entry('Timer', 'A countdown or a stopwatch.', COMPACT,
        {defaults: {mode: 'timer', minutes: 25}, multiple: true, tone: 'tertiary'}),
    note: entry('Note', 'A slip of paper for a few lines. Write on it while the widgets are held over the windows.', ALL,
        {defaults: {text: ''}, multiple: true, tone: 'secondary'}),
    daylight: entry('Daylight', 'Sunrise, sunset and where the sun stands, for the place of the weather.', COMPACT, {tone: 'secondary', opens: ['org.gnome.Weather']}),
    air: entry('Air', 'The air quality index and the pollen at the place of the weather, from Open-Meteo.', COMPACT,
        {opens: ['org.gnome.Weather']}),
    processes: entry('Top processes', 'The programs that use the most processor time or memory.', WIDE,
        {defaults: {by: 'cpu'}, opens: MONITOR}),
    countdown: entry('Countdown', 'The days until a date of your choice.', COMPACT,
        {defaults: {title: '', date: ''}, multiple: true, tone: 'primary'}),
    tasks: entry('Tasks', 'A list to tick off. Write a task while the widgets are held over the windows.', WIDE,
        {defaults: {items: []}, multiple: true, tone: 'tertiary'}),
    pomodoro: entry('Pomodoro', 'Work and breaks in turn: four rounds, then a long break.', COMPACT,
        {defaults: {work: 25, rest: 5}, multiple: true, tone: 'primary'}),
    photo: entry('Photo', 'A picture from a folder, a different one every hour.', ALL,
        {defaults: {folder: ''}, bare: true, multiple: true}),
};

export const typeSizes = Object.fromEntries(Object.entries(catalog).map(([type, widget]) => [type, widget.sizes]));

// What a fresh installation shows until the user arranges it.
export const STARTERS = [
    ['clock', 'small'],
    ['calendar', 'small'],
    ['weather', 'medium'],
    ['system', 'medium'],
];
