import { NS } from "@ns"
import { getNeighbours, getMaxMoneyServers, getProgramsCount, getMaxThreadsCount, getServerRamAvailable } from "utils"

/**
 * @param {NS} ns
 * @param {string[]} neighbours
 * @param {string} targetHost
 * @param {string} sourceHost
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function basic_hack(ns: NS, neighbours: string[], targetHost: string, sourceHost: string) {
    const filename = 'basic_hack.js'

    for (const host of neighbours) {
        const maxThreads = getMaxThreadsCount(ns, host, ns.getScriptRam(filename))
        if (maxThreads === 0)
            continue

        ns.scp(filename, host, sourceHost)
        ns.exec(filename, host, maxThreads, targetHost)
        ns.tprint(`\n\thost: ${host}\n\tmaxRam: ${ns.getServerMaxRam(host)}\n\tramReq: ${ns.getScriptRam(filename, host)}\n\tmaxThreads: ${maxThreads}\n\tTheoretical RAM Usage: ${maxThreads * ns.getScriptRam(filename, host)}\n\tActual RAM Usage: ${ns.getServerUsedRam(host)}\n`)
    }
}

type ThreadsDistribution = {
    hack: number
    weaken1: number
    grow: number
    weaken2: number
}

type HwgwOptions = {
    noLaunch?: boolean
    noSleep?: boolean
    baseThreads?: ThreadsDistribution
}

const defaultThreadsDistribution: Readonly<ThreadsDistribution> = {
    hack: 1,
    weaken1: 1,
    grow: 12,
    weaken2: 1
}

function getBatchRamRequirements(ns: NS, { hack, weaken1, grow, weaken2 }: ThreadsDistribution): number {
    return ns.getScriptRam('hack.js') * hack + ns.getScriptRam('weaken.js') * (weaken1 + weaken2) + ns.getScriptRam('grow.js') * grow
}

function log(ns: NS, data: string) {
    ns.write('log.txt', `[${new Date().toLocaleString()}] ${data}\n`)
}

function infolog(ns: NS, data: string) {
    ns.write('infolog.txt', `[${new Date().toLocaleString()}] ${data}\n`)
}

/**
 * @param {NS} ns
 * @param {string[]} neighbours
 * @param {string} targetHost
 * @param {boolean} noLaunch
 */
async function hwgw(
    ns: NS,
    neighbours: string[],
    targetHost: string,
    baseThreads: ThreadsDistribution = structuredClone(defaultThreadsDistribution)
) {
    // hack -> weaken -> grow -> weaken
    const delay = 50
    const executionQueue = [
        { filename: 'hack.js', name: 'hack', time: Math.ceil(ns.getHackTime(targetHost)), i: 0 },
        { filename: 'weaken.js', name: 'weaken1', time: Math.ceil(ns.getWeakenTime(targetHost)), i: 1 },
        { filename: 'grow.js', name: 'grow', time: Math.ceil(ns.getGrowTime(targetHost)), i: 2 },
        { filename: 'weaken.js', name: 'weaken2', time: Math.ceil(ns.getWeakenTime(targetHost)), i: 3 }
    ].sort((a, b) => b.time - a.time)

    const longestTime = Math.max(...executionQueue.map(x => x.time))
    const batchTime = longestTime + delay * 2
    const timeToNextBatch = batchTime + delay * 2

    /**
     * |         =======      | hack
     * |==================    | weaken
     * |      ==============  | grow
     * |    ==================| weaken
     *  <-------------------->
     *         batchTime
     *         |         =======      | hack
     *         |==================    | weaken
     *         |      ==============  | grow
     *         |    ==================| weaken
     *          <-------------------->

     * What if weaken not the slowest?

     * |       =========      | hack
     * |  ================    | weaken
     * |====================  | grow
     * |      ================| weaken
     *  <-------------------->
     *         batchTime

     * We'll ignore this kind of circumstances for now.
     */

    // growThreads * growthSecurityPerThread + hackThreads * hackSecurityPerThread = weakenThreads * weakenPerThread
    // 2g + h <= 25w
    // h <= 25w - 2g
    // 1   1 12
    // 2   2 24
    // 3   3 36
    // 3   1 11
    // 5   1 10

    // const baseRamReq = ns.getScriptRam('hack.js') * baseThreads.hack + ns.getScriptRam('weaken.js') * (baseThreads.weaken1 + baseThreads.weaken2) + ns.getScriptRam('grow.js') * baseThreads.grow
    const startTime = Date.now()

    const pids = []
    for (const host of neighbours) {
        for (let i = 0; i < executionQueue.length; i++) {
            const action = executionQueue[i]
            if (baseThreads[action.name as keyof typeof baseThreads] === 0)
                continue

            const sleepTime = Math.ceil(batchTime - action.time - (executionQueue.length - action.i - 1) * delay)
            if (sleepTime < 0) {
                throw `sleepTime is less than 0.\n\nbatchTime: ${batchTime}\naction.time: ${action.time}`
            }

            // launch action
            pids.push(ns.exec(
                action.filename,
                host,
                baseThreads[action.name as keyof typeof baseThreads],
                targetHost,
                sleepTime
            ))
        }
    }

    // end - log deviation
    const totalExecutionTime = Date.now() - startTime + timeToNextBatch
    ns.print('INFO: time deviation: ', totalExecutionTime - timeToNextBatch)

    return pids
}

async function multipleHwgw(ns: NS, neighbours: string[], targetHosts: string[], targetHackAmount: number, ramLimit: number) {
    const pids: Record<string, number[]> = {}
    for (const targetHost of targetHosts)
        pids[targetHost] = []

    const potentialTargets = targetHosts.map(targetHost => ({ hostname: targetHost, badTarget: false }))

    log(ns, `neighbours: ${neighbours}`)
    log(ns, `potentialTargets: ${potentialTargets.map(x => x.hostname)}`)
    log(ns, `targetHackAmount: ${targetHackAmount}`)
    log(ns, `ramLimit: ${ramLimit}`)

    // eslint-disable-next-line no-constant-condition
    while (true) {
        for (const targetHost of potentialTargets) {
            if (targetHost.badTarget || pids[targetHost.hostname].some(pid => ns.isRunning(pid)))
                continue

            const minHackAmount = ns.hackAnalyze(targetHost.hostname)
            const threads: ThreadsDistribution = {
                hack: Math.max(Math.ceil(targetHackAmount / minHackAmount), 1),
                weaken1: 1,
                grow: 1,
                weaken2: 1
            }
            const hostMaxMoney = ns.getServerMaxMoney(targetHost.hostname)
            const hostAvailMoney = ns.getServerMoneyAvailable(targetHost.hostname)
            const hostSecLevel = ns.getServerSecurityLevel(targetHost.hostname)
            const hostMinSecLevel = ns.getServerMinSecurityLevel(targetHost.hostname)

            const weakenEffect = ns.weakenAnalyze(1)
            const growthSecInc = ns.growthAnalyzeSecurity(1)
            const hackSecInc = ns.hackAnalyzeSecurity(1)

            let targetNeedsPreparations = false
            if (hostSecLevel > hostMinSecLevel) {
                threads.hack = 0
                threads.weaken1 = 0
                threads.grow = 0
                threads.weaken2 = 1

                targetNeedsPreparations = true
            }
            else if (hostMaxMoney > hostAvailMoney) {
                threads.hack = 0
                threads.weaken1 = 0
                threads.grow = Math.floor(weakenEffect / growthSecInc)
                threads.weaken2 = 1

                targetNeedsPreparations = true
            }

            let ramReq = getBatchRamRequirements(ns, threads)
            let host = neighbours.find(host => getServerRamAvailable(ns, host) > ramReq) || ''
            for (; threads.hack > 0; threads.hack--) {
                threads.grow = Math.ceil(ns.growthAnalyze(targetHost.hostname, hostMaxMoney / (hostMaxMoney * (1 - threads.hack * minHackAmount))))
                threads.weaken1 = Math.ceil(hackSecInc * threads.hack / weakenEffect)
                threads.weaken2 = Math.ceil(growthSecInc * threads.grow / ns.weakenAnalyze(1))

                ramReq = getBatchRamRequirements(ns, threads)
                host = neighbours.find(host => getServerRamAvailable(ns, host) > ramReq) || ''

                //log(ns, `targetHost ${targetHost.hostname}: for ${JSON.stringify(threads)}, ramReq: ${ramReq}, ramLimit: ${ramLimit}, host: ${host}`)
                if (ramReq < ramLimit && host !== '')
                    break;
            }

            if (!targetNeedsPreparations && ramReq > ramLimit || host === '') {
                targetHost.badTarget = true
                log(ns, `!!BADTARGET!! marking host '${targetHost.hostname}' as badTarget.`)
                continue
            }

            if (targetNeedsPreparations) {
                if (host === '' || threads.hack !== 0 || threads.weaken1 !== 0)
                    throw `targetNeedsPreparations=true and host=''...\n\nDon't be like that pls...`

                const k = getMaxThreadsCount(ns, host, ramReq)
                threads.weaken2 *= k
                threads.grow *= k
            }

            infolog(ns, `launching batch on '${host}' with targetHost='${targetHost.hostname}',hack=${threads.hack},weaken1=${threads.weaken1},grow=${threads.grow},weaken2=${threads.weaken2},hackAmount=${threads.hack * minHackAmount}`)

            pids[targetHost.hostname] = await hwgw(ns, [host], targetHost.hostname, threads)
        }

        await ns.sleep(1000)
    }
}

/** @param {NS} ns */
export async function main(ns: NS) {
    type Args = {
        depth: number,
        targetHost?: string,
        minRam: number,
    }

    const args: Args = {
        depth: 3,
        minRam: 4,
    }

    if (ns.args[0] === '-d' && ns.args[1]) {
        if (!Number.isInteger(ns.args[1])) {
            ns.tprint(`Invalid second argument: should be integer, but got '${ns.args[1]}' with type '${typeof ns.args[1]}'`)
            return
        }
        args.depth = ns.args[1] as number
        ns.args.shift()
        ns.args.shift()
    }

    if (ns.args[0] === '-r' && ns.args[1]) {
        if (!Number.isInteger(ns.args[1])) {
            ns.tprint(`Invalid second argument: should be integer, but got '${ns.args[1]}' with type '${typeof ns.args[1]}'`)
            return
        }
        args.minRam = Math.max(ns.args[1] as number, 4)
        ns.args.shift();
        ns.args.shift()
    }

    if (ns.serverExists(ns.args[0] as (string | undefined) || '')) {
        args.targetHost = ns.args[0] as string
        ns.args.shift()
    }

    ns.enableLog('ALL')

    const allNeighbours = getNeighbours(ns, args.depth)
    const maxOpenPorts = getProgramsCount(ns)
    const neighbours = allNeighbours.filter(x => (ns.getServerNumPortsRequired(x) <= maxOpenPorts || ns.hasRootAccess(x)) && ns.getServerMaxRam(x) >= args.minRam)
    const filenames = ['hack.js', 'weaken.js', 'grow.js']
    const potentialTargets = getMaxMoneyServers(ns, neighbours, maxOpenPorts).filter(x => x !== 'home')
    const targetHost = args.targetHost || potentialTargets[0]
    const sourceHost = 'home'

    ns.tprint(`\n\tallNeighbours: ${allNeighbours}\n\tneighbours: ${neighbours}\n\ttargetHost: ${targetHost}\n\tsourceHost: ${sourceHost}\n\n`)

    for (const host of neighbours.filter(x => !ns.hasRootAccess(x))) {
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

    ns.write('log.txt', '', 'w')

    for (const host of neighbours)
        filenames.forEach(function (filename) { ns.scp(filename, host, sourceHost) })

    ns.write('log.txt', '', 'w')

    const ramLimit = 2048
    const targetHackAmount = 0.9
    const purchasedServers = ns.getPurchasedServers()
    if (purchasedServers.reduce((a, v) => ns.getServerMaxRam(v) + a, 0) > 1024 * 20)
        await multipleHwgw(ns, [...purchasedServers, 'home'], potentialTargets, targetHackAmount, ns.getServerMaxRam(purchasedServers[0]))
    else
        await multipleHwgw(ns, neighbours, potentialTargets, targetHackAmount, ramLimit)

    // eslint-disable-next-line no-constant-condition
    // while (true)
    //     await hwgwWaterfall(ns, neighbours, targetHost)
}

/**
 * @param {NS} ns
 * @param {string[]} neighbours
 * @param {string} targetHost
 * @param {boolean} noLaunch
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function hwgwWaterfall(
    ns: NS,
    neighbours: string[],
    targetHost: string,
    {
        noLaunch = false,
        noSleep = false,
        baseThreads = structuredClone(defaultThreadsDistribution)
    }: HwgwOptions = {}
) {
    // hack -> weaken -> grow -> weaken
    const delay = 50
    const executionQueue = [
        { filename: 'hack.js', name: 'hack', time: Math.ceil(ns.getHackTime(targetHost)), i: 0 },
        { filename: 'weaken.js', name: 'weaken1', time: Math.ceil(ns.getWeakenTime(targetHost)), i: 1 },
        { filename: 'grow.js', name: 'grow', time: Math.ceil(ns.getGrowTime(targetHost)), i: 2 },
        { filename: 'weaken.js', name: 'weaken2', time: Math.ceil(ns.getWeakenTime(targetHost)), i: 3 }
    ].sort((a, b) => b.time - a.time)

    const longestTime = Math.max(...executionQueue.map(x => x.time))
    const batchTime = longestTime + delay * 2
    const timeToNextBatch = batchTime + delay * 2

    /**
     * |         =======      | hack
     * |==================    | weaken
     * |      ==============  | grow
     * |    ==================| weaken
     *  <-------------------->
     *         batchTime
     *         |         =======      | hack
     *         |==================    | weaken
     *         |      ==============  | grow
     *         |    ==================| weaken
     *          <-------------------->

     * What if weaken not the slowest?

     * |       =========      | hack
     * |  ================    | weaken
     * |====================  | grow
     * |      ================| weaken
     *  <-------------------->
     *         batchTime

     * We'll ignore this kind of circumstances for now.
     */
    const delays = executionQueue.map(el => batchTime - el.time - (executionQueue.length - el.i - 1) * delay)
    if (delays[0] !== 0)
        ns.tprint('WARNING: delays[0] !== 0; delays: ', delays)

    // Threads distribution
    //const baseThreads = baseThreads
    if (baseThreads.grow === 0) {
        ns.tprint(`WARNING: calling batch with baseThreads: { hack: ${baseThreads.hack}, grow: ${baseThreads.grow}, weaken1: ${baseThreads.weaken1}, weaken2: ${baseThreads.weaken2} }
            \tdefaultThreadsDistribution: { hack: ${defaultThreadsDistribution.hack}, grow: ${defaultThreadsDistribution.grow}, weaken1: ${defaultThreadsDistribution.weaken1}, weaken2: ${defaultThreadsDistribution.weaken2} }`)
    }
    // growThreads * growthSecurityPerThread + hackThreads * hackSecurityPerThread = weakenThreads * weakenPerThread
    // 2g + h <= 25w
    // h <= 25w - 2g
    // 1   1 12
    // 2   2 24
    // 3   3 36
    // 3   1 11
    // 5   1 10

    if (ns.getServerMoneyAvailable(targetHost) / ns.getServerMaxMoney(targetHost) >= 0.95) {
        baseThreads.grow = Math.min(Math.ceil(ns.growthAnalyze(targetHost, ns.getServerMaxMoney(targetHost) / (ns.getServerMoneyAvailable(targetHost) * (1 - ns.hackAnalyze(targetHost))))), 12)
        baseThreads.hack = 1
    }

    if (!noLaunch && ns.getServerSecurityLevel(targetHost) > ns.getServerMinSecurityLevel(targetHost)) {
        ns.tprint('WARNING: ', targetHost, '\'s security level is not minimum')
        baseThreads.hack = 0
        baseThreads.grow = 0
    }

    const baseRamReq = ns.getScriptRam('hack.js') * baseThreads.hack + ns.getScriptRam('weaken.js') * (baseThreads.weaken1 + baseThreads.weaken2) + ns.getScriptRam('grow.js') * baseThreads.grow
    const startTime = Date.now()

    ns.write('log.txt', `INFO: Batch parameters ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}:\n`)
    ns.write('log.txt', ` targetHost: ${targetHost}\n`)
    ns.write('log.txt', ` delay: ${delay}\n`)
    ns.write('log.txt', ` baseThreads: hack=${baseThreads.hack}; grow=${baseThreads.grow}; weaken1=${baseThreads.weaken1}; weaken2=${baseThreads.weaken2}\n`)
    for (const action of executionQueue) {
        ns.write('log.txt', ` action name: ${action.name}; time: ${action.time}; i: ${action.i}\n`)
        ns.write('log.txt', `\tsleepTime: ${Math.ceil(batchTime - action.time - (executionQueue.length - action.i - 1) * delay)}ms\n`)
    }
    ns.write('log.txt', ` batchTime: ${batchTime}\n timeToNextBatch: ${timeToNextBatch}\n`)

    const waitTime = noSleep ? 0 : delay * 2
    let totalWaitTime = 0
    const pids = []
    for (let hostIndex = 0, actualHostIndex = 0; hostIndex < neighbours.length; hostIndex++) {
        const host = neighbours[hostIndex]

        if (ns.getServerUsedRam(host) > 0) {
            ns.write('log.txt', ` WARNING: UsedRam > 0 (${ns.getServerUsedRam(host)})\n\thost: ${host}\n\tscripts:\n`)
            for (const script of ns.ps(host)) {
                ns.write('log.txt', `\t\tfilename: ${script.filename}\n\t\tpid: ${script.pid}\n\t\tthreads: ${script.threads}\n\t\targs: ${script.args}\n\n`)
            }

            if (!noSleep)
                await ns.sleep(delay)

            if (actualHostIndex > 0)
                totalWaitTime += delay
        }
        const threadsMultiplier = getMaxThreadsCount(ns, host, baseRamReq)
        if (threadsMultiplier === 0)
            continue

        const batchStartDelay = baseThreads.grow === 0 ? 0 : ((delay * 4 * actualHostIndex++) - totalWaitTime)
        ns.write('log.txt', ` batchStartDelay[${actualHostIndex}] for host=${host}: ${batchStartDelay} with totalWaitTime: ${totalWaitTime}\n`)

        if (!noSleep)
            await ns.sleep(waitTime)
        totalWaitTime += waitTime

        for (let i = 0; i < executionQueue.length; i++) {
            const action = executionQueue[i]
            if (baseThreads[action.name as keyof typeof baseThreads] === 0)
                continue

            const sleepTime = Math.ceil(batchTime - action.time - (executionQueue.length - action.i - 1) * delay)
            if (sleepTime < 0) {
                throw `sleepTime is less than 0.\n\nbatchTime: ${batchTime}\naction.time: ${action.time}`
            }

            // launch action
            if (!noLaunch)
                pids.push(ns.exec(
                    action.filename,
                    host,
                    baseThreads[action.name as keyof typeof baseThreads] * threadsMultiplier,
                    targetHost,
                    sleepTime + batchStartDelay)
                )
        }
    }

    if (!noLaunch && !noSleep)
        await ns.sleep(timeToNextBatch - totalWaitTime)

    // end - log deviation
    const totalExecutionTime = Date.now() - startTime + timeToNextBatch * Number(noLaunch) * Number(noSleep)
    ns.print('INFO: time deviation: ', totalExecutionTime - timeToNextBatch)

    return pids
}