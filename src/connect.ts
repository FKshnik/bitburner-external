import { AutocompleteData, NS } from "@ns";
import { error } from "./utils";

export function autocomplete(data: AutocompleteData, _args: string[]) {
    return data.servers
}

type Host = {
    name: string
    parent?: Host
}

/** @param {NS} ns */
export async function main(ns: NS) {
    if (!ns.args[0] || !ns.serverExists(ns.args[0] as string)) {
        ns.tprint(error(`Server name either undefined or doesn't exist.`))
        return
    }

    const path: string[] = getPathToServer(ns, ns.args[0] as string)
    ns.tprint(`Path to '${ns.args[0]}': ${path.join(' -> ')}`)

    for (const host of path)
        ns.singularity.connect(host)
}

export function getPathToServer(ns: NS, hostname: string) {
    const visited: Set<string> = new Set()
    const stack: Host[] = []
    stack.push({ name: 'home' })

    while (stack.length > 0) {
        const currentHost = stack.pop()!
        visited.add(currentHost.name)

        if (currentHost.name === hostname)
            return getPath(currentHost)

        for (const host of ns.scan(currentHost.name)) {
            if (!visited.has(host))
                stack.push({ name: host, parent: currentHost })
        }
    }

    throw `Unreachable getPathToServer(), hostname: ${hostname}`
}

function getPath(host?: Host) {
    if (!host)
        throw `error: host is ${host}`

    const path: string[] = []
    while (host) {
        path.push(host.name)
        host = host.parent
    }

    return path.reverse()
}