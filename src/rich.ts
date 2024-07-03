import { NS } from "@ns"
import * as utils from "utils"

/** @param {NS} ns */
export async function main(ns: NS) {
    if (ns.args.length === 0 || !Number.isInteger(ns.args[0])) {
        ns.tprint(`error: expected 1 argument of type 'int', but got typeof args[0] = '${typeof ns.args[0]}'`)
        return
    }

    const openPorts = utils.getProgramsCount(ns)
    const neighbours = utils.getNeighbours(ns, ns.args[0] as number).sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a))

    ns.tprint('Programs count: ', openPorts)
    ns.tprint('From richest to poorest: ', neighbours)
    ns.tprint(utils.getMaxMoneyServer(ns, neighbours, openPorts))
}