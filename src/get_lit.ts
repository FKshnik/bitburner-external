import { NS } from "@ns"
import { getNeighbours } from "./utils"

/** @param { NS } ns */
export async function main(ns: NS) {
    const args = ns.flags([['d', 20]])
    const neighbours = getNeighbours(ns, args.d as number)
    const destination = 'n00dles'

    for (const server of neighbours) {
        ns.scp(ns.ls(server, '.lit'), destination, server)
    }
}