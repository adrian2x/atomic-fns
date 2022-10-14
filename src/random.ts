import { isObject, round } from './globals'

export const random = (min = 0, max = 1) => Math.random() * (max - min) + min

export const randomInt = (min = 0, max = 1) => round(random(min, max), 0)

export const choice = (arr: any[]) => {
  if (!arr?.length) return
  const index = randomInt(0, arr.length - 1)
  return arr[index]
}

export function sample(arr: any[], k: number) {
  if (!arr?.length) return
  const result: any[] = []
  while (k--) result.push(choice(arr))
  return result
}

export function shuffle(arr) {
  if (isObject(arr)) arr = Object.values(arr)
  const n = arr.length - 1
  for (let i = n; i > 0; i--) {
    const j = randomInt(0, i)
    const temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
}
