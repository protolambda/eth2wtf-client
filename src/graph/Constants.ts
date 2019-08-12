import cytoscape from "cytoscape";

// content ID. A byte. Used to identify the type of graph content.
export type ContentID = number;

export type ChunkID = number;

export type WSSendFn = (msg: Buffer) => void;
export type CY = cytoscape.Core;

export type Point = {
    x: number;
    y: number;
}

export const pixelsPerSecond = 10;

// A chunk width, in pixels.
export const chunkWidth = 600 * pixelsPerSecond;

