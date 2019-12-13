import cytoscape, {NodeSingular} from "cytoscape";

// Used to identify the type of graph content.
export type EventTypeID = number;

export type EventIndex = number;

export type WSSendFn = (msg: DataView) => void;
export type CY = cytoscape.Core;

export type Point = {
    x: number;
    y: number;
}

export type CustomLayoutOptions = {
    // ignore empty slots or not
    compact: boolean,
    // the separation between adjacent nodes with the same slot
    nodeSep: number,
    // the separation between slots
    slotSep: number,
    // pull latest to front
    pullLatest: boolean,
}

export const pixelsPerSecond = 10;

export const defaultCustomLayoutOpts: CustomLayoutOptions = {
    compact: false,
    nodeSep: pixelsPerSecond,
    slotSep: pixelsPerSecond * 6,
    pullLatest: false,
};

export type GraphEventType = {
    transform: (node: NodeSingular, pos: Point) => Point
    processEvent: (buf: DataView, eventIndex: EventIndex, cy: CY) => void
}
