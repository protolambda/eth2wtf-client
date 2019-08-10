import cytoscape, {EdgeSingularTraversing, EventObject, NodeSingular} from "cytoscape";
import ReconnectingWebSocket from "reconnecting-websocket";

type CY = cytoscape.Core;

type WSStatusHandler = (status: boolean) => void;

type WSCloser = () => void;

export type LayoutOptionsData = {
    // ignore empty slots or not
    compact: boolean,
    // the separation between adjacent nodes with the same slot
    nodeSep: number,
    // the separation between adjacent edges with the same slot
    edgeSep: number,
    // the separation between slots
    rankSep: number,
}

type Point = {
    x: number;
    y: number;
}

// content ID. A byte. Used to identify the type of graph content.
type ContentID = number;

type ChunkContentData = any;

type ChunkID = number;

type TimestampMS = number;

type ChunkData = {
    lastRequestTimestamp: TimestampMS;
    contents: Record<ContentID, ChunkContentData>
}

const chunkUpdateDelay: TimestampMS = 1000;

type WSSendFn = (msg: Buffer) => void;

const slotWidth = 100;
// A chunk width, in pixels, each pixel is 1/100 of a second.
const chunkWidth = 400 * 100;

type GraphContentType = {
    id: ContentID;
    transform: (node: NodeSingular, pos: Point) => Point;
    loadChunk: (id: ChunkID, ws: WSSendFn) => void;
    unloadChunk: (id: ChunkID, data: ChunkContentData, ws: WSSendFn, cy: CY) => void;
    updateChunk: (id: ChunkID, data: ChunkContentData, ws: WSSendFn) => void;
    initContent: (id: ChunkID) => ChunkContentData;
    handleMsg: (buf: Buffer, data: ChunkContentData, cy: CY) => void
}

function now(): TimestampMS {
    return Date.now();
}

// Viewport width * unloadRatio == width of margin around viewport that is not unloaded.
// Rounded up, dealt with in chunks.
const unloadRatio = 0.3;

export class Graph {

    private onWsStatusChange: WSStatusHandler;

    private cy: CY;

    private minChunk: ChunkID;
    private maxChunk: ChunkID;

    private chunks: Map<ChunkID, ChunkData>;

    private contentTypes: Record<ContentID, GraphContentType>;

    constructor(cy: CY, onWsStatusChange: WSStatusHandler) {
        this.cy = cy;
        this.onWsStatusChange = onWsStatusChange;
        this.chunks = new Map();
        // TODO init with latest chunk? (viewport and prefer. slot -> bounds)
        this.minChunk = 0;
        this.maxChunk = 0;
        this.contentTypes = [
            // TODO blocks, eth1, attestations, etc.
        ];
    }

    layoutDag(opts: LayoutOptionsData) {
        const options = {
            animate: true,
            animationDuration: 2000,
            name: 'dagre',
            ranker: 'network-simplex',
            nodeSep: opts.nodeSep,
            edgeSep: opts.edgeSep,
            rankSep: opts.rankSep,
            // @ts-ignore
            rankDir: 'LR', // TODO: maybe rotate on mobile layout?
            // TODO: maybe check the type of the node. I.e. only position eth2 blocks to align to slots?
            // @ts-ignore
            transform: ( node: NodeSingular, pos: Point): Point =>
                ({x: node.data('slot') * slotWidth, y: pos.y}),
        };

        if (!opts.compact) {
            // @ts-ignore
            options.minLen = ((edge: EdgeSingularTraversing ) => edge.target().data('slot') - edge.source().data('slot'));
        }
        const layout = this.cy.layout(options);
        layout.run();
    };

    setupWS(): WSCloser {
        const rws = new ReconnectingWebSocket('ws://localhost:4000/ws', [], {debug: true});
        rws.binaryType = 'arraybuffer';
        rws.addEventListener('close', () => this.onWsStatusChange(false));
        rws.addEventListener('open', () => this.onWsStatusChange(true));
        rws.addEventListener('message', this.onMessageEvent);
        return () => {
            rws.close();
        };
    };

    sendWSMsg(buf: Buffer) {
        // TODO: ws
        console.log("send msg: ", buf);
    }

    loadChunk(chunkID: ChunkID) {
        // if the chunk already exists:
        const c = this.chunks.get(chunkID);
        if(c !== undefined) {
            // only update if not requested again within X time.
            const t = now();
            if (c.lastRequestTimestamp + chunkUpdateDelay < t) {
                // request data
                for (let ct of Object.values(this.contentTypes)) {
                    ct.updateChunk(chunkID, c.contents[ct.id], this.sendWSMsg);
                }
            }
        } else {
            const contents: Record<ContentID, ChunkContentData> = {};
            for (let ct of Object.values(this.contentTypes)) {
                contents[ct.id] = ct.initContent;
            }
            const chunk = {
                lastRequestTimestamp: now(),
                contents: contents,
            };
            // start loading new chunk
            this.chunks.set(chunkID, chunk);
            // request data
            for (let ct of Object.values(this.contentTypes)) {
                ct.loadChunk(chunkID, this.sendWSMsg);
            }
        }
    }

    unloadChunk(chunkID: ChunkID) {
        const c = this.chunks.get(chunkID);
        if(c) {
            this.cy.batch(() => {
                // unload all contents of the chunk
                for (let ct of Object.values(this.contentTypes)) {
                    ct.unloadChunk(chunkID, c.contents[ct.id], this.sendWSMsg, this.cy);
                }
            });
        }
        this.chunks.delete(chunkID);
    }

    setupCY() {
        this.cy.on('viewport', (event: EventObject) => {
            const extent = this.cy.extent();
            const minChunk = Math.floor(extent.x1 / chunkWidth);
            const maxChunk = Math.ceil(extent.x2 / chunkWidth);
            const chunks = maxChunk - minChunk;
            const unloadChunks = Math.ceil(chunks / unloadRatio);

            // bounds are inclusive (i.e. not unloaded)
            const minUnloadBound = this.minChunk - unloadChunks;
            const maxUnloadBound = this.maxChunk + unloadChunks;

            // unload on min side, only out of margin bounds.
            for (let i = minUnloadBound - 1; i >= 0; i--) {
                if (!this.chunks.has(i)) {
                    // stop when the chunk does not exist
                    break;
                }
                this.unloadChunk(i);
            }

            const chunksWithMargin = chunks + unloadChunks + unloadChunks;
            // Start loading from center of the view. Expand outwards.
            let left = minChunk + Math.floor(chunks / 2);
            let right = left + 1;
            for (let i = 0; i < chunksWithMargin; i++) {
                if (left >= minUnloadBound) {
                    this.loadChunk(left);
                    left--;
                }
                if (right <= maxUnloadBound) {
                    this.loadChunk(right);
                    right++;
                }
            }

            // unload on max side, only out of margin bounds.
            for (let i = maxUnloadBound + 1; ; i++) {
                if (!this.chunks.has(i)) {
                    // stop when the chunk does not exist
                    break;
                }
                this.unloadChunk(i);
            }
        });
    }

    onMessageEvent(ev: MessageEvent) {
        const msg: Buffer = ev.data;
        if (msg.byteLength < 1) {
            console.log("msg too short");
            return;
        }

        const msgType = msg[0];
        console.log(`received msg of type ${msgType}`);

        switch (msgType) {
            // 1: messages that are content-specific updates.
            case 1:
                if (msg.byteLength < 6) {
                    console.log("expected content identifier byte and chunk ID in msg");
                    return;
                }
                const contentID: ContentID = msg[1];
                const ct = this.contentTypes[contentID];
                if (!ct) {
                    console.log("unexpected content identifier: ", contentID);
                    return;
                }
                const chunkID = (new Uint32Array(msg, 2, 4))[0];
                const chunk = this.chunks.get(chunkID);
                if(!chunk) {
                    console.log(`expected to have chunk ${chunkID} available for content type ${contentID}`);
                    return;
                }
                const chunkContent = chunk.contents[contentID];
                if(!chunkContent) {
                    console.log(`chunk ${chunkID} data for content type ${contentID} was not initialized properly`);
                    return;
                }
                // pass a view of the message buffer, with the topic cut off.
                ct.handleMsg(msg.subarray(2), chunkContent, this.cy);
                break;
            case 2:
                // TODO update status
                break;
            default:
                // TODO
                break;
        }
    }
}
