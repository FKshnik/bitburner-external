import { AutocompleteData, NS } from "@ns";
import { createTypedArgs, error, getProgramsCount, getRootAccess, Schema } from "./utils";
import { connect } from "./connect";

const schema = [['faction', false], ['company', false], ['all', false]] as const

const servers = {
    factions: [
        'CSEC',
        'avmnite-02h',
        'I.I.I.I',
        'run4theh111z'
    ],
    companies: [
        'ecorp',
        'megacorp',
        'kuai-gong',
        '4sigma',
        'nwo',
        'blade',
        'omnitek',
        'b-and-a',
        'clarkinc',
        'fulcrumtech',
        'fulcrumassets'
    ],
    async backdoorFactions(ns: NS) {
        await backdoor(ns, ...this.factions)
    },
    async backdoorCompanies(ns: NS) {
        await backdoor(ns, ...this.companies)
    }
}

export function autocomplete(data: AutocompleteData, _args: string[]) {
    data.flags(schema as unknown as Schema)
    return data.servers
}

export async function backdoor(ns: NS, ...servers: string[]) {
    for (const hostname of servers) {
        if (!ns.serverExists(hostname)) {
            ns.tprint(error(`Cannot backdoor server '${hostname}': host doesn't exist (yet?).`))
            continue
        }

        if (ns.getServer(hostname).backdoorInstalled === undefined) {
            ns.tprint(error(`Server '${hostname}': BackdoorInstalled flag is undefined?`))
            continue
        }

        if (ns.getServer(hostname).backdoorInstalled === true) {
            ns.tprint(`Backdoor on server '${hostname}' is already installed.`)
            continue
        }

        if (ns.getServerRequiredHackingLevel(hostname) > ns.getHackingLevel()) {
            ns.tprint(error(`Cannot backdoor server '${hostname}': hacking level is too low (required: ${ns.getServerRequiredHackingLevel(hostname)}).`))
            continue
        }

        if (getProgramsCount(ns) < ns.getServerNumPortsRequired(hostname)) {
            ns.tprint(error(`Cannot backdoor server '${hostname}': cannot open required number of ports for successful nuke (has: ${getProgramsCount(ns)}, required: ${ns.getServerNumPortsRequired(hostname)}).`))
            continue
        }

        getRootAccess(ns, [hostname])

        connect(ns, hostname)
        await ns.singularity.installBackdoor()
        connect(ns, 'home')

        ns.tprint(`Successfully installed backdoor on server '${hostname}'.`)
    }
}

export async function main(ns: NS) {
    const flags = createTypedArgs(ns, schema)
    if (flags._.length !== 0) {
        await backdoor(ns, ...flags._ as string[])
    }

    if (flags.all || flags._.length === 0) {
        await servers.backdoorFactions(ns)
        await servers.backdoorCompanies(ns)
        return
    }

    if (flags.faction)
        await servers.backdoorFactions(ns)

    if (flags.company)
        await servers.backdoorCompanies(ns)
}