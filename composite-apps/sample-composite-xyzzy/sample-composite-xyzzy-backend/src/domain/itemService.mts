import { randomUUID } from "node:crypto";


export interface Item {
    id:          string;
    name:        string;
    description: string;
}


// In-memory store. A real application would persist to a database.
const items: Array<Item> = [];


export function createItem(name: string, description: string): Item {
    const item: Item = { id: randomUUID(), name, description };
    items.push(item);
    return item;
}


export function getItems(): Array<Item> {
    return [...items];
}


export function getItemById(id: string): Item | undefined {
    return items.find((item) => item.id === id);
}


export function updateItem(
    id:           string,
    name?:        string,
    description?: string
): Item | undefined {
    const item = items.find((i) => i.id === id);
    if (!item) { return undefined; }
    if (name !== undefined)        { item.name        = name;        }
    if (description !== undefined) { item.description = description; }
    return item;
}
