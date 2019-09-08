import CytoScape, {EventObject, NodeSingular} from "cytoscape";
import ReconnectingWebSocket from "reconnecting-websocket";
import {
    ChunkContent,
    ChunkID,
    chunkWidth,
    ContentID,
    CY,
    GraphContentTypeDef, Point,
} from "./Constants";
import CustomLayout from "./CustomLayout";
import {BlockHeadersChunkContent, BlockHeadersContentType} from "./BlockHeaders";

CytoScape.use(CustomLayout);

type WSStatusHandler = (status: boolean) => void;

type WSCloser = () => void;

type TimestampMS = number;

type ChunkData = {
    lastRequestTimestamp: TimestampMS;
    contents: Record<ContentID, ChunkContent>
}

const chunkUpdateDelay: TimestampMS = 100;


function now(): TimestampMS {
    return Date.now();
}


export const ChunkBoundaryContentType = {
    transform: (node: NodeSingular, pos: Point) => {
        const chunk_id: number | undefined = node.data('chunk_id');
        if (chunk_id !== undefined) {
            return ({
                x: chunk_id * chunkWidth,
                y: 0,
            }) // TODO: pos.y?
        } else {
            return pos;
        }
    },
    initContent: (chunkID: ChunkID, contentID: ContentID) => new BlockHeadersChunkContent(chunkID, contentID)
};

// Viewport width * unloadRatio == width of margin around viewport that is not unloaded.
// Rounded up, dealt with in chunks.
const unloadRatio = 1.3;

export class Graph {

    private onWsStatusChange: WSStatusHandler;

    private cy: CY;

    private minChunk: ChunkID;
    private maxChunk: ChunkID;

    private _sendWS: undefined | ((msg: ArrayBufferView) => void);
    private _closeWS: undefined | WSCloser;

    private chunks: Map<ChunkID, ChunkData>;

    private contentTypes: Array<GraphContentTypeDef>;

    public layoutDag: () => void;

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

        // TODO test compact view (no transform, plain un-ranked dag)
        // if (!opts.compact) {
        //     // @ts-ignore
        //     options.minLen = ((edge: EdgeSingularTraversing ) => edge.target().data('slot') - edge.source().data('slot'));
        // }
        this.layoutDag = () => {
            console.log("cannot run layout, uninitialized");
        }
    }

    fit() {
        this.cy.fit();
    }

    pan(x: number, y: number) {
        this.cy.pan({x: x, y: y})
    }

    close = () => {
        if (this._closeWS) {
            this._closeWS();
        }
    };

    setupWS = () => {
        const rws = new ReconnectingWebSocket('ws://localhost:4000/ws', [], {debug: true});
        rws.binaryType = 'arraybuffer';
        rws.addEventListener('close', () => this.onWsStatusChange(false));
        rws.addEventListener('open', () => this.onWsStatusChange(true));
        rws.addEventListener('message', this.onMessageEvent);
        this._sendWS = rws.send.bind(rws);
        this._closeWS = () => {
            this._sendWS = undefined;
            rws.close();
        };
    };

    sendWSMsg = ((msg: DataView) => {
        if(this._sendWS) {
            console.log("sending msg: ", msg);
            this._sendWS(msg);
        } else {
            console.log("not connected to WS, could not send msg: ", msg);
        }
    });

    loadChunk(chunkID: ChunkID) {
        // console.log("loading chunk", chunkID);
        // if the chunk already exists:
        const c = this.chunks.get(chunkID);
        if(c !== undefined) {
            // only update if not requested again within X time.
            const t = now();
            if (c.lastRequestTimestamp + chunkUpdateDelay < t) {
                console.log("refreshing older existing chunk", chunkID);
                c.lastRequestTimestamp = t;
                // refresh data
                for (let ct of this.contentTypes) {
                    const content = c.contents[ct.ID];
                    content.refresh(this.sendWSMsg);
                }
            }
        } else {
            // console.log("loading new chunk", chunkID);
            const contents: Record<ContentID, ChunkContent> = {};
            for (let ct of this.contentTypes) {
                contents[ct.ID] = ct.ContentType.initContent(chunkID, ct.ID);
            }
            const chunk = {
                lastRequestTimestamp: now(),
                contents: contents,
            };
            // console.log("created new chunk", chunkID, chunk);
            // start loading new chunk
            this.chunks.set(chunkID, chunk);
            // load data
            for (let ct of this.contentTypes) {
                const content = chunk.contents[ct.ID];
                content.load(this.sendWSMsg);
            }
        }
    }

    unloadChunk(chunkID: ChunkID) {
        console.log("unloading chunk", chunkID);
        const c = this.chunks.get(chunkID);
        if(c) {
            this.cy.batch(() => {
                // unload all contents of the chunk
                for (let ct of this.contentTypes) {
                    const content = c.contents[ct.ID];
                    content.unload(this.sendWSMsg, this.cy);
                }
            });
        }
        this.chunks.delete(chunkID);
    }

    loadView() {
        const extent = this.cy.extent();
        console.log("viewport event, extent:", extent);
        // console.log("current zoom: ", this.cy.zoom());

        const minChunk = Math.floor(extent.x1 / chunkWidth);
        const maxChunk = Math.ceil(extent.x2 / chunkWidth);
        const chunks = maxChunk - minChunk;

        if (chunks > 10) {
            console.log("too many chunks! aborting");
            return
        }

        const unloadChunks = Math.round(chunks * unloadRatio);

        // console.log({minChunk, maxChunk, chunks, unloadChunks});

        // bounds are inclusive (i.e. not unloaded)
        const minUnloadBound = Math.max(minChunk - unloadChunks, 0);
        const maxUnloadBound = maxChunk + unloadChunks;

        // console.log({minUnloadBound, maxUnloadBound});

        // unload on min side, only out of margin bounds.
        for (let i = minUnloadBound - 1; i >= 0; i--) {
            if (!this.chunks.has(i)) {
                // stop when the chunk does not exist
                break;
            }
            this.unloadChunk(i);
        }

        // Start loading from center of the view. Expand outwards.
        let left = Math.floor((minUnloadBound + maxUnloadBound) / 2);
        let right = left + 1;
        // console.log({left, right});
        while (true) {
            if (left >= minUnloadBound) {
                this.loadChunk(left);
                left--;
            }
            if (right <= maxUnloadBound) {
                this.loadChunk(right);
                right++;
            }
            if (left < minUnloadBound && right > maxUnloadBound) {
                break;
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
        // console.log("finished viewport update");
    }

    setupCY() {
        const options = {
            animate: false,
            animationDuration: 0,
            name: 'custom_layout',
            fit: false,
        };

        this.layoutDag = () => {
            console.log("running layout!");
            const layout = this.cy.layout(options);
            layout.run();
        };
        this.loadView();
        this.cy.on('viewport', (event: EventObject) => {
            this.loadView();
        });
    }

    onMessageEvent = (ev: MessageEvent) => {
        console.log("msg event: ", ev);

        const msg: ArrayBuffer = ev.data;
        if (msg.byteLength < 1) {
            console.log("msg too short");
            return;
        }

        const data = new DataView(msg);
        const msgType = data.getUint8(0);
        console.log(`received msg of type ${msgType}`);

        switch (msgType) {
            // 1: messages that are content-specific updates.
            case 1:
                if (msg.byteLength < 6) {
                    console.log("expected content identifier byte and chunk ID in msg");
                    return;
                }
                const contentID: ContentID = data.getUint8(1);
                const ct = this.contentTypes.find(ct => ct.ID === contentID);
                if (!ct) {
                    console.log("unexpected content identifier: ", contentID);
                    return;
                }
                const chunkID = data.getUint32(2, true);
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
                chunkContent.handleMsg(new DataView(msg, 6), this.cy, this.layoutDag);
                break;
            case 2:
                // TODO update status
                break;
            default:
                // TODO
                break;
        }
    };

}
