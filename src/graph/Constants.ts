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

export const pixelsPerSecond = 10;

export type GraphEventType = {
    transform: (node: NodeSingular, pos: Point) => Point
    processEvent: (buf: DataView, eventIndex: EventIndex, cy: CY) => void
}
