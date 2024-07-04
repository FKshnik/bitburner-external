import { NS } from "@ns";
import { error } from "./utils";

/** @param {NS} ns */
export async function main(ns: NS) {
    const args = ns.flags([['info', false], ['buy', false], ['r', 32]])
    const servers = ns.getPurchasedServers()
    if (!args.buy && (servers.length === 0 || servers.every(server => ns.getServerMaxRam(server) === ns.getPurchasedServerMaxRam()))) {
        ns.tprint(error('No purchased servers to upgrade.'))
        return
    }

    if (args.buy) {
        if (args.info) {
            ns.tprint(`

        Cost of buying 1 server: ${ns.getPurchasedServerCost(args.r as number)}
        Cost of buying all servers: ${ns.getPurchasedServerCost(args.r as number) * (ns.getPurchasedServerLimit() - servers.length)}
        RAM on servers: ${ns.formatRam(args.r as number)}`)

            return
        }

        if (servers.length === ns.getPurchasedServerLimit()) {
            ns.tprint(error('Can\'t buy. You already have maximum amount of servers.'))
            return
        }

        for (let i = servers.length; i < ns.getPurchasedServerLimit(); i++)
            ns.purchaseServer(`pserv-${i}`, args.r as number)

        return
    }

    const currentRam = Math.max(...servers.map(server => ns.getServerMaxRam(server)))
    const upgradeRam = servers.filter(server => ns.getServerMaxRam(server) === currentRam).length === servers.length ? currentRam * 2 : currentRam
    const upgradeCosts = servers.map(server => ns.getPurchasedServerUpgradeCost(server, upgradeRam))
    const totalUpgradeCost = upgradeCosts.reduce((a, v) => a + v, 0)
    const oneServerUpgradeCost = [...new Set(upgradeCosts)]

    if (args.info) {
        ns.tprint(`
        
    Cost to upgrade 1 server     : ${oneServerUpgradeCost.length === 1 ? ns.formatNumber(oneServerUpgradeCost[0]) : oneServerUpgradeCost.map(cost => ns.formatNumber(cost))}
    Total upgrade servers cost   : ${ns.formatNumber(totalUpgradeCost)}
    Current max RAM servers have : ${ns.formatRam(currentRam)}
    Upgrade RAM to               : ${ns.formatRam(upgradeRam)}
    RAM limit                    : ${ns.formatRam(ns.getPurchasedServerMaxRam())}`)

        return
    }

    if (totalUpgradeCost < ns.getServerMoneyAvailable('home')) {
        for (const server of servers)
            ns.upgradePurchasedServer(server, upgradeRam)

        ns.tprint(`Servers upgraded to ${ns.formatRam(upgradeRam)} of RAM.`)
    }
    else
        ns.tprint(error('Not enough money for upgrade.'))
}