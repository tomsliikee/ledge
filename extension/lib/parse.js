// Readings from /proc and from nvidia-smi, turned into numbers. Pure, so
// the parsers run in the tests without a shell.

// The first line of /proc/stat sums all cores, in ticks since boot.
export function parseCpu(text) {
    const line = text.split('\n').find(l => l.startsWith('cpu '));
    if (!line)
        return null;
    const ticks = line.trim().split(/\s+/).slice(1).map(Number);
    // idle and iowait are the two kinds of not working.
    const idle = ticks[3] + (ticks[4] ?? 0);
    const total = ticks.slice(0, 8).reduce((sum, n) => sum + n, 0);
    const cores = text.split('\n').filter(l => /^cpu\d+ /.test(l)).length;
    return {idle, total, cores};
}

export function cpuPercent(previous, next) {
    if (!previous || !next)
        return null;
    const total = next.total - previous.total;
    if (total <= 0)
        return null;
    return 100 * (1 - (next.idle - previous.idle) / total);
}

const KIB = 1024;

export function parseMemory(text) {
    const field = name => {
        const match = new RegExp(`^${name}:\\s+(\\d+) kB`, 'm').exec(text);
        return match ? Number(match[1]) * KIB : null;
    };
    const total = field('MemTotal');
    const available = field('MemAvailable');
    if (!total || available === null)
        return null;
    const used = total - available;
    return {total, used, percent: 100 * used / total};
}

// Bridges and container ends repeat traffic that a real interface already counts.
const VIRTUAL = /^(lo|veth|docker|br-|virbr|vnet)/;

export function parseNetwork(text) {
    let received = 0;
    let sent = 0;
    for (const line of text.split('\n').slice(2)) {
        const [name, rest] = line.split(':');
        if (!rest || VIRTUAL.test(name.trim()))
            continue;
        const fields = rest.trim().split(/\s+/).map(Number);
        received += fields[0];
        sent += fields[8];
    }
    return {received, sent};
}

// Bytes per second between two readings; a counter that went backwards
// (interface reset) gives 0 instead of a negative rate.
export function networkRate(previous, next, seconds) {
    if (!previous || !next || seconds <= 0)
        return null;
    return {
        down: Math.max(0, next.received - previous.received) / seconds,
        up: Math.max(0, next.sent - previous.sent) / seconds,
    };
}

// One line of: nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total
//              --format=csv,noheader,nounits
export function parseNvidia(line) {
    const fields = line.split(',').map(field => Number.parseFloat(field));
    if (fields.length < 4 || fields.some(Number.isNaN))
        return null;
    const MIB = 1024 * 1024;
    return {
        percent: fields[0],
        temperature: fields[1],
        memoryUsed: fields[2] * MIB,
        memoryTotal: fields[3] * MIB,
    };
}

// Without a usage counter, where the GPU's clock stands between its lowest
// and highest frequency is the nearest sign of how busy it is.
export function clockPercent(current, min, max) {
    if (![current, min, max].every(Number.isFinite) || max <= min)
        return null;
    return Math.min(100, Math.max(0, 100 * (current - min) / (max - min)));
}

// /proc/<pid>/stat: the name sits in brackets and may itself hold spaces
// and brackets, so the fields are counted from the last closing bracket.
export function parseProcess(text) {
    const open = text.indexOf('(');
    const close = text.lastIndexOf(')');
    if (open < 0 || close < 0)
        return null;
    const fields = text.slice(close + 2).split(' ');
    return {
        pid: Number(text.slice(0, open).trim()),
        name: text.slice(open + 1, close),
        ticks: Number(fields[11]) + Number(fields[12]),
        pages: Number(fields[21]),
    };
}

// previous and next map pid to a parsed process; totalTicks is what all
// cores together could have worked between the two readings.
export function topProcesses(previous, next, totalTicks, {by, count, pageSize, cores}) {
    const rows = [];
    for (const [pid, now] of next) {
        const before = previous.get(pid);
        // A pid that was reused by another program must not inherit its ticks.
        const worked = before && before.name === now.name ? now.ticks - before.ticks : 0;
        rows.push({
            name: now.name,
            // Per cent of one core, as system monitors show it.
            cpu: totalTicks > 0 ? Math.max(0, 100 * cores * worked / totalTicks) : 0,
            memory: now.pages * pageSize,
        });
    }
    rows.sort((a, b) => b[by] - a[by]);
    return rows.slice(0, count);
}

// hwmon reports millidegrees.
export function milliCelsius(text) {
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) ? value / 1000 : null;
}
