import { NS } from "@ns"

export type SchemaType = Parameters<NS['flags']>[0]

export enum Color {
    Cyan = "\u001b[36m",
    Green = "\u001b[32m",
    Red = "\u001b[31m",
    Reset = "\u001b[0m",
}

export function paintString(color: Color, data: string): string {
    return `${color}${data}${Color.Reset}`
}

export function error(data: string): string {
    return paintString(Color.Red, data)
}

/**
 * @param {NS} ns
 * @param {number} depth
 * @returns {string[]} Returns an array of hostnames.
 */
export function getNeighbours(ns: NS, depth: number): string[] {
    const levels = [ns.scan()]
    const scanned: Record<string, boolean> = {}

    for (let i = 1; i < depth; i++) {
        levels.push([])
        for (const server of levels[i - 1]) {
            if (scanned[server])
                continue

            levels[i].push(...ns.scan(server))
            scanned[server] = true
        }
    }

    return [...new Set(levels.flat())]
}

/**
 * @param {NS} ns
 * @param {string[]} servers Array of servers.
 * @param {number} openPorts Number of open ports required to nuke.
 * @returns {string[]} Returns a servers sorted by their max money.
 */
export function getMaxMoneyServers(ns: NS, servers: string[], openPorts: number): string[] {
    return servers.filter(x => ns.getServerNumPortsRequired(x) <= openPorts && ns.getServerRequiredHackingLevel(x) <= Math.max(ns.getHackingLevel(), 1) && ns.getServerMaxMoney(x) > 0 && ns.getServerMoneyAvailable(x) > 0)
        .sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a))
}

/**
 * @param {NS} ns
 * @param {string[]} servers Array of servers.
 * @param {number} openPorts Number of open ports required to nuke.
 * @returns {string} Returns a server with maximum money value bigger than the others.
 */
export function getMaxMoneyServer(ns: NS, servers: string[], openPorts: number): string {
    return getMaxMoneyServers(ns, servers, openPorts)[0]
}
/**
 * @param {NS} ns 
 * @param {string[]} servers Server names for which root access would tried to be granted.
 */
export function getRootAccess(ns: NS, servers: string[]): void {
    const sourceHost = 'home'
    for (const host of servers) {
        if (ns.fileExists('BruteSSH.exe', sourceHost))
            ns.brutessh(host)

        if (ns.fileExists('FTPCrack.exe', sourceHost))
            ns.ftpcrack(host)

        if (ns.fileExists('relaySMTP.exe', sourceHost))
            ns.relaysmtp(host)

        if (ns.fileExists('HTTPWorm.exe', sourceHost))
            ns.httpworm(host)

        if (ns.fileExists('SQLInject.exe', sourceHost))
            ns.sqlinject(host)

        ns.nuke(host)
    }
}

/**
 * @param {NS} ns
 * @returns {number} Returns current programs count.
 */
export function getProgramsCount(ns: NS): number {
    return ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'].filter(p => ns.fileExists(p)).length
}

/**
 * @param {NS} ns
 * @param {string} server Hostname of the target server.
 * @param {number} ram RAM (GB) requirements.
 * @returns {number} The maximum amount of threads the script can utilize on target server.
 */
export function getMaxThreadsCount(ns: NS, server: string, ram: number): number {
    const serverRamAvailable = ns.getServerMaxRam(server) - ns.getServerUsedRam(server) - Number(server === 'home') * 16
    return Math.floor(serverRamAvailable / ram)
}

/**
 * 
 * @param {NS} ns 
 * @param {string} server Hostname of the target server.
 * @returns The amount of available RAM (GB) on the specified server.
 */
export function getServerRamAvailable(ns: NS, server: string): number {
    return ns.getServerMaxRam(server) - ns.getServerUsedRam(server) - Number(server === 'home') * 16
}