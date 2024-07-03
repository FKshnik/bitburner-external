import { NS } from "@ns";
import { error } from "./utils";

/** @param {NS} ns */
export async function main(ns: NS) {
    const args = ns.flags([['info', false], ['buy', false], ['n', 0]])
    const servers = ns.getPurchasedServers()
    if (!args.buy && servers.length === 0 || servers.every(server => ns.getServerMaxRam(server) === ns.getPurchasedServerMaxRam())) {
        ns.tprint(error('No purchased servers to upgrade.'))
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