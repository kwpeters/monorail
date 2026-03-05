// eslint-disable-next-line @typescript-eslint/no-implied-eval
export const isBrowser = new Function("try {return this===window;}catch(e){ return false;}");

// eslint-disable-next-line @typescript-eslint/no-implied-eval
export const isNode = new Function("try {return this===global;}catch(e){return false;}");
