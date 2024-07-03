import { NS } from "@ns"
import * as utils from "utils.js"

/** @param {NS} ns */
export async function main(ns: NS) {
    // ns.hackAnalyze
    // ns.hackAnalyzeChance
    // ns.hackAnalyzeSecurity
    // ns.hackAnalyzeThreads

    // ns.growthAnalyze
    // ns.growthAnalyzeSecurity

    // ns.weakenAnalyze
    ns.tprint(ns.getHackTime('max-hardware') / 1000, ' ', ns.getGrowTime('max-hardware') / 1000, ' ', ns.getWeakenTime('max-hardware') / 1000)
    ns.tprint(0.5 / ns.hackAnalyze('silver-helix'), ' ', ns.growthAnalyze('silver-helix', 1 / 0.5))

    // const hostname = 'omega-net'
    // for (let i = 1; i < 10; i++) {
    //     const h = 1 * i
    //     const w = 1 * i
    //     const g = i * ((25 - (h / i)) / 2)
    //     const hackAmount = ns.hackAnalyze(hostname) * h
    //     const growThreads = ns.growthAnalyze(hostname, ns.getServerMaxMoney(hostname) / (ns.getServerMaxMoney(hostname) * (1 - hackAmount)))

    //     ns.tprint(`\n\th: ${h}\n\tw: ${w}\n\tg: ${g}\n\thackAnalyze: ${hackAmount}\n\tneedGrowThreadsToCompensate: ${growThreads}`)
    // }

    // const targetHost = 'phantasy'
    // const weakenPerThread = ns.weakenAnalyze(1)
    // const growthSecurityPerThread = ns.growthAnalyzeSecurity(1, targetHost)
    // const growthToMaxRatio = ns.getServerMaxMoney(targetHost) / ns.getServerMoneyAvailable(targetHost)
    // const growThreadsToMax = Math.ceil(ns.growthAnalyze(targetHost, growthToMaxRatio))
    // const hackSecurityPerThread = ns.hackAnalyzeSecurity(1)

    // ns.tprint(weakenPerThread, ' ', growthSecurityPerThread, ' ', hackSecurityPerThread)
}