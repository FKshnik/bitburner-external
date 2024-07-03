import { NS } from "@ns"

/** @param {NS} ns */
export async function main(ns: NS) {
    const host = ns.args[0] as string

    if (!host) {
        ns.tprint('error: host not specified')
        return
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (ns.getServerSecurityLevel(host) > ns.getServerMinSecurityLevel(host))
            await ns.weaken(host)

        else if (ns.getServerMoneyAvailable(host) < ns.getServerMaxMoney(host))
            await ns.grow(host)

        else
            await ns.hack(host)
    }
}