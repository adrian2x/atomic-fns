export const bind = (fn, self, ...args) => fn.bind(self, ...args)

export const partial = (fn, ...args) => bind(fn, {}, ...args)
