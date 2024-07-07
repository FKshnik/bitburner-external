import { NS } from "@ns";
import { error, SchemaType, AutocompleteData } from "./utils";

const schema: SchemaType = [['info', false], ['buy', false], ['r', 32], ['auto', false]]

export function autocomplete(data: AutocompleteData, _args: string[]) {
    data.flags(schema)
    return []
}

/** @param {NS} ns */
export async function main(ns: NS) {
    const args = ns.flags(schema)
    const servers = ns.getPurchasedServers()
    if (!args.buy && (servers.length === 0 || servers.every(server => ns.getServerMaxRam(server) === ns.getPurchasedServerMaxRam()))) {
        ns.tprint(error('No purchased servers to upgrade.'))
        return
    }

    if (args.buy) {
        if (args.info) {
            ns.tprint(`

        Cost of buying 1 server    : ${ns.formatNumber(ns.getPurchasedServerCost(args.r as number))}
        Cost of buying all servers : ${ns.formatNumber(ns.getPurchasedServerCost(args.r as number) * (ns.getPurchasedServerLimit() - servers.length))}
        RAM on servers             : ${ns.formatRam(args.r as number)}`)

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

    if (args.auto) {
        while (ns.getPurchasedServers().length < ns.getPurchasedServerLimit()) {
            const servers = ns.getPurchasedServers()

            while (ns.getServerMoneyAvailable('home') < ns.getPurchasedServerCost(args.r as number)) {
                await ns.sleep(200)
            }

            for (let i = servers.length; i < ns.getPurchasedServerLimit(); i++)
                ns.purchaseServer(`pserv-${i}`, args.r as number)
        }

        const servers = ns.getPurchasedServers()
        while (ns.getServerMaxRam(servers[0]) < ns.getPurchasedServerMaxRam()) {
            if (ns.getPurchasedServerUpgradeCost(servers[0], ns.getServerMaxRam(servers[0]) * 2) * servers.length < ns.getServerMoneyAvailable('home'))
                ns.exec(ns.getScriptName(), 'home', 1)

            await ns.sleep(200)
        }

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