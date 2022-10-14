export const randomInt = (min = 0, max = 2) => Math.floor(Math.random() * (max - min) + min)

export const randomBit = (p = 0.5) => Math.random() < p
