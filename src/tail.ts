import { AutocompleteData, NS } from "@ns";
import { createTypedArgs, error, Schema } from "./utils";

export function autocomplete(data: AutocompleteData, _args: string[]) {
    data.flags(schema as unknown as Schema)
    return [...data.txts, ...data.scripts]
}

const schema = [['n', 200]] as const

/** @param {NS} ns */
export async function main(ns: NS) {
    const args = createTypedArgs(ns, schema)
    const filename = args._[0] as string || ''
    const delimiter = '\n'

    if (!ns.fileExists(filename)) {
        ns.tprint(error('error: must provide a file name to open.'))
        return
    }

    if (!(args.n > 0)) {
        ns.tprint(error('error: -n must be positive.'))
        return
    }

    const contents = ns.read(filename)
    ns.alert(`${filename}\n\n${contents.split(delimiter).slice(-args.n).join(delimiter)}`)
}