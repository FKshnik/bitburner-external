import { NS } from "@ns"

/** @param {NS} ns */
export async function main(ns: NS) {
    await ns.grow(ns.args[0] as string, { additionalMsec: ns.args[1] as number })
}