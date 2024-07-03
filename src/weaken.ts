import { NS } from "@ns"

/** @param {NS} ns */
export async function main(ns: NS) {
    await ns.sleep(ns.args[1] as number)
    await ns.weaken(ns.args[0] as string)
}