import { AutocompleteData, Multipliers, NS } from "@ns"
import { createTypedArgs, Schema } from "./utils"

type Augmentation = {
    name: string
    preReqs: Augmentation[]
    price: number
    minEffectivePrice: number
}

type State = {
    parent?: State
    augmentationRepository: AugmentationRepository
    boughtAugmentations: Augmentation[]
    leftToPurchase: Augmentation[]
    totalPrice: number
    totalMultipliers: Multipliers
}

type MultsKeys = {
    hacking: Array<keyof Multipliers>
    combat: Array<keyof Multipliers>
    charisma: Array<keyof Multipliers>
}

type HeuristicFunction = (augmentation: Augmentation, additionalData?: object) => number

class AugmentationRepository {
    augmentations: Map<string, Augmentation> = new Map()

    constructor(...augmentations: Augmentation[]) {
        for (const augmentation of augmentations)
            this.augmentations.set(augmentation.name, augmentation)

        for (const [key, value] of this.augmentations) {
            const preReqs: Augmentation[] = []
            for (const preReq of value.preReqs) {
                preReqs.push(this.augmentations.get(preReq.name)!)
            }

            this.augmentations.get(key)!.preReqs = preReqs
        }
    }

    public get(augmentationName: string) {
        return this.augmentations.get(augmentationName)
    }

    public delete(augmentationName: string) {
        if (augmentationName === 'NeuroFlux Governor' || !this.augmentations.has(augmentationName))
            return

        for (const preReqAug of this.augmentations.get(augmentationName)!.preReqs) {
            this.augmentations.delete(preReqAug.name)
        }

        this.augmentations.delete(augmentationName)
    }

}

const schema = [['hacking', false], ['combat', false], ['charisma', false], ['price', false], ['efficiency', false], ['performance', false]] as const
const AUGMENTATION_PRICE_INCREASE = 1.9

const multsKeys: MultsKeys = {
    hacking: [
        'hacking',
        'hacking_chance',
        'hacking_exp',
        'hacking_grow',
        'hacking_money',
        'hacking_speed'
    ],
    combat: [
        'agility',
        'agility_exp',
        'strength',
        'strength_exp',
        'defense',
        'defense_exp',
        'dexterity',
        'dexterity_exp'
    ],
    charisma: [
        'charisma',
        'charisma_exp'
    ]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAllPreReqs(ns: NS, augmentationName: string) {
    const preReqs = ns.singularity.getAugmentationPrereq(augmentationName)

    for (const preReqAugName of preReqs) {
        preReqs.push(...getAllPreReqs(ns, preReqAugName))
    }

    return [...new Set(preReqs)]
}

function getMinEffectivePrice(ns: NS, augmentation: Augmentation, ownedAugmentations: Augmentation[] = []) {
    let leftToProcess = structuredClone([augmentation, ...augmentation.preReqs])
    let totalPrice = 0

    for (const aug of leftToProcess)
        aug.preReqs = aug.preReqs.filter((preReqAugment) => !ownedAugmentations.some((ownedAug) => ownedAug.name === preReqAugment.name))

    while (leftToProcess.length > 0) {
        const noPreReqAug = leftToProcess.filter((aug) => aug.preReqs.length === 0).toSorted((a, b) => b.price - a.price).shift()!
        if (!noPreReqAug)
            throw `noPreReqAug is undefined. leftToProcess: ${JSON.stringify(leftToProcess)}\naugmentation: ${JSON.stringify(augmentation)}\noriginal leftToProcess: ${JSON.stringify([augmentation, ...augmentation.preReqs])}\npreReqs: ${JSON.stringify(augmentation.preReqs)}\noriginal preReqs: ${JSON.stringify(getAllPreReqs(ns, augmentation.name).map((aug) => createAugmentationFromName(ns, aug)))}`

        leftToProcess = leftToProcess.filter((aug) => aug.name !== noPreReqAug.name)

        for (const aug of leftToProcess) {
            aug.price *= AUGMENTATION_PRICE_INCREASE
            aug.preReqs = aug.preReqs.filter((preReqAug) => preReqAug.name !== noPreReqAug.name)
        }

        totalPrice += noPreReqAug.price
    }

    return totalPrice
}

function doOperationOnMultipliers(operation: (...x: number[]) => number, ...mults: Multipliers[]) {
    const retval = structuredClone(mults[0])

    for (const key in mults[0])
        if (Object.prototype.hasOwnProperty.call(mults[0], key) && typeof mults[0][key as keyof Multipliers] === 'number')
            retval[key as keyof Multipliers] = operation(...mults.map((m) => m[key as keyof Multipliers]))

    return retval
}

function multiplyMultipliers(...mults: Multipliers[]) {
    return doOperationOnMultipliers((...x) => x.reduce((a, v) => a * v), ...mults)
}

function getMultipliersSum(mults: Multipliers, includedKeys: Array<keyof Multipliers> = []) {
    let total = 0

    for (const key in mults) {
        if (Object.prototype.hasOwnProperty.call(mults, key)
            && typeof mults[key as keyof Multipliers] === 'number'
            && (includedKeys.length === 0 || includedKeys.includes(key as keyof Multipliers))
        )
            total += mults[key as keyof Multipliers]
    }

    return total
}

function createAugmentationFromName(ns: NS, augmentation: string): Augmentation {
    return {
        name: augmentation,
        preReqs: ns.singularity.getAugmentationPrereq(augmentation).map((preReqAug) => createAugmentationFromName(ns, preReqAug)),//getAllPreReqs(ns, augmentation),
        price: ns.singularity.getAugmentationPrice(augmentation),
        minEffectivePrice: 0
    }
}

function createAugmentationsFromNames(ns: NS, augmentations: string[]): Augmentation[] {
    const retval: Augmentation[] = []
    for (const augmentation of augmentations)
        retval.push(createAugmentationFromName(ns, augmentation))

    return retval
}

function getPurchasableAugmentations(ns: NS) {
    const factions = ns.getPlayer().factions
    const allAugmentations = new Set<string>()

    for (const faction of factions)
        for (const augmentation of ns.singularity.getAugmentationsFromFaction(faction))
            allAugmentations.add(augmentation)

    return createAugmentationsFromNames(ns, [...allAugmentations.difference(new Set(ns.singularity.getOwnedAugmentations(true)))])
}

function getCoefficient(ns: NS, constraints: Array<keyof Multipliers>, augmentation: Augmentation) {
    return getMultipliersSum(
        multiplyMultipliers(
            ns.singularity.getAugmentationStats(augmentation.name),
            ...augmentation.preReqs.map(
                (aug) => ns.singularity.getAugmentationStats(aug.name)
            ),
        ),
        constraints
    ) / augmentation.minEffectivePrice
}

function getPrice(augmentation: Augmentation) {
    return augmentation.minEffectivePrice
}

function getAugmentationMultipliersSum(ns: NS, constraints: Array<keyof Multipliers>, augmentation: Augmentation) {
    return getMultipliersSum(ns.singularity.getAugmentationStats(augmentation.name), constraints)
}

/** @param {NS} ns */
export async function main(ns: NS) {
    const flags = createTypedArgs(ns, schema)
    const ownedAugmentations = createAugmentationsFromNames(ns, ns.singularity.getOwnedAugmentations(true))
    const constraints: Array<keyof Multipliers> = []

    let purchasableAugmentations = getPurchasableAugmentations(ns)

    if (flags.hacking) {
        constraints.push(...multsKeys.hacking)
    }

    if (flags.combat) {
        constraints.push(...multsKeys.combat)
    }

    if (flags.charisma) {
        constraints.push(...multsKeys.charisma)
    }

    const getHeuristics = function (): HeuristicFunction {
        if (flags.efficiency)
            return getCoefficient.bind(null, ns, constraints)

        if (flags.price)
            return getPrice

        return getAugmentationMultipliersSum.bind(null, ns, constraints)
    }()

    purchasableAugmentations = purchasableAugmentations.filter((aug) => {
        if (constraints.length === 0)
            return true

        const stats = ns.singularity.getAugmentationStats(aug.name)
        for (const key of constraints)
            if (stats[key] > 1)
                return true

        return false
    })

    // ensure that all prereq augmentations of every purchasable augmentation are owned or purchasable as well
    purchasableAugmentations = purchasableAugmentations.filter((aug) =>
        new Set(ns.singularity.getAugmentationPrereq(aug.name)).isSubsetOf(new Set([
            ...purchasableAugmentations.map((aug) => aug.name),
            ...ownedAugmentations.map((aug) => aug.name)
        ]))
    )

    for (const aug of purchasableAugmentations) {
        aug.preReqs = aug.preReqs.filter((augmentation) => !ownedAugmentations.map(x => x.name).includes(augmentation.name))
        aug.minEffectivePrice = getMinEffectivePrice(ns, aug, ownedAugmentations)
    }

    purchasableAugmentations.sort((a, b) => b.minEffectivePrice - a.minEffectivePrice)

    const moneyLimit = ns.getServerMoneyAvailable('home')
    const buyCombinations: State[] = []

    const queue: State[] = []
    queue.push({
        augmentationRepository: new AugmentationRepository(...purchasableAugmentations),
        boughtAugmentations: [],
        leftToPurchase: [...purchasableAugmentations],
        totalPrice: 0,
        totalMultipliers: ns.getPlayer().mults
    })
    ns.tprint(`Purchasable Augmentations: ${purchasableAugmentations.map(x => x.name)}`)

    while (queue.length > 0) {
        const state = queue.shift()!;
        let canPurchaseNow = state.leftToPurchase.filter((aug) => moneyLimit - state.totalPrice >= aug.minEffectivePrice)

        // path end condition - no more to purchase now
        if (canPurchaseNow.length === 0) {
            buyCombinations.push(state)
            continue
        }

        ns.print(`\n  Bought (${state.boughtAugmentations.length}):\n  ${state.boughtAugmentations.map(x => x.name)}\n  Left (${state.leftToPurchase.length}):\n  ${state.leftToPurchase.map(x => x.name)}`)

        if (canPurchaseNow.length > 1)
            canPurchaseNow = canPurchaseNow.filter((aug) => aug.name !== 'NeuroFlux Governor')

        const getHighestScoringAugmentations = (augmentations: Augmentation[]) => {
            const maxCoeffCount = augmentations
                .map((aug) => getHeuristics(aug))
                .toSorted((a, b) => b - a)
                .filter((coeff, _, arr) => arr[0] === coeff)
                .length

            return augmentations
                .toSorted((a, b) => getHeuristics(b) - getHeuristics(a))
                .slice(0, maxCoeffCount)
        }

        //ns.tprint(`\n  coefficients: ${JSON.stringify(canPurchaseNow.map((aug) => ({ name: aug.name, coeff: getHeuristics(aug) })), null, '  ')}`)

        canPurchaseNow = [
            ...getHighestScoringAugmentations(canPurchaseNow),
            ...getHighestScoringAugmentations(canPurchaseNow.filter((aug) => aug.preReqs.length === 0))
        ]

        {
            const helper = new Map<string, Augmentation>()
            for (const aug of canPurchaseNow)
                if (!helper.has(aug.name))
                    helper.set(aug.name, aug)

            canPurchaseNow = [...helper.values()]
        }

        for (const newAugmentation of canPurchaseNow) {
            const newAugmentationRepository = new AugmentationRepository(...structuredClone([...state.augmentationRepository.augmentations.values()]))

            // newAugmentation = state.augmentationRepository.augmentations.get('Cranial Signal Processors - Gen V')!
            // Object.assign(newAugmentation, state.augmentationRepository.augmentations.get('Cranial Signal Processors - Gen V'))

            newAugmentationRepository.delete(newAugmentation.name)

            const newState: State = {
                parent: state,
                augmentationRepository: newAugmentationRepository,
                boughtAugmentations: [...state.boughtAugmentations, newAugmentation],
                leftToPurchase: [...newAugmentationRepository.augmentations.values()],
                totalPrice: state.totalPrice + newAugmentation.minEffectivePrice,
                totalMultipliers: multiplyMultipliers(state.totalMultipliers, ns.singularity.getAugmentationStats(newAugmentation.name), ...newAugmentation.preReqs.map((aug) => ns.singularity.getAugmentationStats(aug.name))),
            }

            // ns.tprint(`before repo: ${JSON.stringify([...newState.augmentationRepository.augmentations.values()], null, '  ')}`)

            for (const aug of newState.leftToPurchase) {
                aug.preReqs = aug.preReqs.filter((preReqAugmentation) => preReqAugmentation.name !== newAugmentation.name && !newAugmentation.preReqs.map(x => x.name).includes(preReqAugmentation.name))
                aug.price *= Math.pow(AUGMENTATION_PRICE_INCREASE, newAugmentation.preReqs.length + 1)
            }

            for (const aug of newState.leftToPurchase)
                aug.minEffectivePrice = getMinEffectivePrice(ns, aug, ownedAugmentations)

            // ns.tprint(`after repo: ${JSON.stringify([...newState.augmentationRepository.augmentations.values()], null, '  ')}`)
            // return

            queue.push(newState)
        }

        await ns.sleep(5)
    }

    buyCombinations.sort((c1, c2) => {
        const m1 = getMultipliersSum(c1.totalMultipliers, constraints)
        const m2 = getMultipliersSum(c2.totalMultipliers, constraints)

        if (m1 === m2)
            return c1.totalPrice - c2.totalPrice

        return m2 - m1
    })

    for (const order of buyCombinations.slice(0, 3))
        ns.tprint(`\n  Buy order:\n  ${order.boughtAugmentations.map(x => x.name).join(' -> ')}\n  totalPrice: ${ns.formatNumber(order.totalPrice)}\n  totalMults: ${JSON.stringify(order.totalMultipliers)}\n  multsSum: ${getMultipliersSum(order.totalMultipliers, constraints)}\n\n`)
}

export function autocomplete(data: AutocompleteData, _args: string[]) {
    data.flags(schema as unknown as Schema)
    return []
}