import cytoscape, {NodeSingular} from "cytoscape";

// content ID. A byte. Used to identify the type of graph content.
export type ContentID = number;

export type ChunkID = number;

export type WSSendFn = (msg: DataView) => void;
export type CY = cytoscape.Core;

export type Point = {
    x: number;
    y: number;
}

export const pixelsPerSecond = 10;

// A chunk width, in pixels.
export const chunkWidth = 16 * 6 * pixelsPerSecond;

export interface ChunkContent {
    load: (ws: WSSendFn) => void;
    unload: (ws: WSSendFn, cy: CY) => void;
    refresh: (ws: WSSendFn) => void;
    handleMsg: (buf: DataView, cy: CY, layout: () => void) => void
}

export type ChunkContentMaker = (chunkID: ChunkID, contentID: ContentID) => ChunkContent;

export type GraphContentType = {
    transform: (node: NodeSingular, pos: Point) => Point;
    initContent: ChunkContentMaker;
}

export type GraphContentTypeDef = {
    ID: ContentID;
    ContentType: GraphContentType;
}
