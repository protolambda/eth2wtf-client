import {EventObject, NodeSingular} from "cytoscape";
import ReconnectingWebSocket from "reconnecting-websocket";
import {ChunkID, chunkWidth, ContentID, CY, Point, WSSendFn} from "./Constants";
import {BlockHeadersContentType} from "./BlockHeaders";

type WSStatusHandler = (status: boolean) => void;

type WSCloser = () => void;

export type LayoutOptionsData = {
    // ignore empty slots or not
    compact: boolean,
    // the separation between adjacent nodes with the same slot
    nodeSep: number,
    // the separation between adjacent edges with the same slot
    edgeSep: number
}

type ChunkContentMaker = (id: ChunkID) => ChunkContent;

interface ChunkContent {
    load: (ws: WSSendFn) => void;
    unload: (ws: WSSendFn, cy: CY) => void;
    refresh: (ws: WSSendFn) => void;
    handleMsg: (buf: Buffer, cy: CY) => void
}

type TimestampMS = number;

type ChunkData = {
    lastRequestTimestamp: TimestampMS;
    contents: Record<ContentID, ChunkContent>
}

const chunkUpdateDelay: TimestampMS = 10000;

type GraphContentType = {
    transform: (node: NodeSingular, pos: Point) => Point;
    initContent: ChunkContentMaker;
}

type GraphContentTypeDef = {
    ID: ContentID;
    ContentType: GraphContentType;
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

    private contentTypes: Array<GraphContentTypeDef>;

    constructor(cy: CY, onWsStatusChange: WSStatusHandler) {
        this.cy = cy;
        this.onWsStatusChange = onWsStatusChange;
        this.chunks = new Map();
        // TODO init with latest chunk? (viewport and prefer. slot -> bounds)
        this.minChunk = 0;
        this.maxChunk = 0;
        this.contentTypes = [
            // TODO blocks, eth1, attestations, etc.
            {ID: 1, ContentType: BlockHeadersContentType}
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
            rankSep: 100, // TODO heuristic?
            // @ts-ignore
            rankDir: 'LR', // TODO: maybe rotate on mobile layout?
            // TODO: maybe check the type of the node. I.e. only position eth2 blocks to align to slots?
            // @ts-ignore
            transform: ( node: NodeSingular, pos: Point): Point => {
                const contentType: GraphContentType | undefined = node.data('content_type');
                if(contentType !== undefined) {
                    return contentType.transform(node, pos);
                } else {
                    return pos;
                }
            },
        };

        // TODO test compact view (no transform, plain un-ranked dag)
        // if (!opts.compact) {
        //     // @ts-ignore
        //     options.minLen = ((edge: EdgeSingularTraversing ) => edge.target().data('slot') - edge.source().data('slot'));
        // }
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

    sendWSMsg = (id: ContentID) => ((buf: Buffer) => {
        // TODO: ws
        console.log("send msg: ", id, buf);
    });

    loadChunk(chunkID: ChunkID) {
        // if the chunk already exists:
        const c = this.chunks.get(chunkID);
        if(c !== undefined) {
            // only update if not requested again within X time.
            const t = now();
            if (c.lastRequestTimestamp + chunkUpdateDelay < t) {
                c.lastRequestTimestamp = t;
                // refresh data
                for (let ct of this.contentTypes) {
                    const content = c.contents[ct.ID];
                    content.refresh(this.sendWSMsg(ct.ID));
                }
            }
        } else {
            const contents: Record<ContentID, ChunkContent> = {};
            for (let ct of this.contentTypes) {
                contents[ct.ID] = ct.ContentType.initContent(chunkID);
            }
            const chunk = {
                lastRequestTimestamp: now(),
                contents: contents,
            };
            // start loading new chunk
            this.chunks.set(chunkID, chunk);
            // load data
            for (let ct of this.contentTypes) {
                const content = chunk.contents[ct.ID];
                content.load(this.sendWSMsg(ct.ID));
            }
        }
    }

    unloadChunk(chunkID: ChunkID) {
        const c = this.chunks.get(chunkID);
        if(c) {
            this.cy.batch(() => {
                // unload all contents of the chunk
                for (let ct of this.contentTypes) {
                    const content = c.contents[ct.ID];
                    content.unload(this.sendWSMsg(ct.ID), this.cy);
                }
            });
        }
        this.chunks.delete(chunkID);
    }

    loadView() {
        const extent = this.cy.extent();
        console.log("viewport event, extent:", extent);

        const minChunk = Math.floor(extent.x1 / chunkWidth);
        const maxChunk = Math.ceil(extent.x2 / chunkWidth);
        const chunks = maxChunk - minChunk;
        const unloadChunks = Math.ceil(chunks / unloadRatio);

        console.log({minChunk, maxChunk, chunks, unloadChunks});

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
    }

    setupCY() {
        this.cy.on('viewport', (event: EventObject) => {
            this.loadView();
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
                chunkContent.handleMsg(msg.subarray(2), this.cy);
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
