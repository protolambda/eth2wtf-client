import {ChunkID, chunkWidth, ContentID, CY, pixelsPerSecond, Point, WSSendFn} from "./Constants";
import {NodeSingular} from "cytoscape";
import {BeaconBlockHeader, Hash} from "@chainsafe/eth2.0-types";
import {types} from "@chainsafe/eth2.0-ssz-types/lib/presets/mainnet";
import {AnyContainerType, deserialize, serialize} from "@chainsafe/ssz";

const secondsPerSlot = 6;

const pixelsPerSlot = secondsPerSlot * pixelsPerSecond;

const slotsPerChunk = chunkWidth / pixelsPerSlot;

const HeadersRequestType: AnyContainerType = {
    fields: [
        ['highestKnown', "uint32"],
        ['wanted', {elementType: "uint32", maxLength: 1024}]
    ],
};

interface HeadersRequest {
    highestKnown: number;
    wanted: Array<number>;
}

const HeaderDataType: AnyContainerType = {
    fields: [
        ['header', types.BeaconBlockHeader],
        ['root', "bytes32"],
        // TODO: more information about the block
    ]
};

interface HeaderData {
    header: BeaconBlockHeader;
    root: Hash;
}

const HeadersResponseType: AnyContainerType = {
    fields: [
        ['indices', {elementType: "uint32", maxLength: 1024}],
        ['headers', {elementType: HeaderDataType, maxLength: 1024}],
    ]
};

interface HeadersResponse {
    indices: Array<number>;
    headers: Array<HeaderData>;
}

export class BlockHeadersChunkContent {

    private chunkID: ChunkID;
    private contentID: ContentID;

    private headerChunkIndices: Array<number>;

    constructor(chunkID: ChunkID, contentID: ContentID) {
        this.chunkID = chunkID;
        this.contentID = contentID;
        this.headerChunkIndices = new Array<number>();
    }

    load(sendWS: WSSendFn){
        console.log("loading headers for chunk ", this.chunkID);

        let best = 0;
        if (this.headerChunkIndices.length > 0) {
            best = this.headerChunkIndices[this.headerChunkIndices.length - 1];
        }

        const wanted = [];
        let j = 0;
        for (let i = 0; i < best; i++) {
            // when we find a gap in the list, we add the index of the gap to the wanted list.
            if (j >= this.headerChunkIndices.length || this.headerChunkIndices[j] > i) {
                wanted.push(i);
            } else {
                j++;
            }
        }

        const req: HeadersRequest = {
            highestKnown: best,
            wanted: this.headerChunkIndices,
        };

        const reqBuf: Buffer = serialize(req, HeadersRequestType);

        const buf = new ArrayBuffer(1 + 1 + 4 + reqBuf.length);
        const data = new DataView(buf);
        data.setUint8(0, 1);
        data.setUint8(1, this.contentID);
        data.setUint32(2, this.chunkID, true);

        reqBuf.copy(new Uint8Array(buf, 0, buf.byteLength), 6);

        sendWS(data)
    }

    unload(ws: WSSendFn, cy: CY){
        console.log("unloading headers for chunk ", this.chunkID);
        // TODO: remove nodes from graph
    }

    refresh(ws: WSSendFn){
        console.log("refreshing headers for chunk ", this.chunkID);
        // TODO: request new data
    }

    handleMsg(msg: DataView, cy: CY){
        // TODO read data with SSZ
        console.log("receiver msg: ", msg);

        const input = Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength);
        const res: HeadersResponse = deserialize(input, HeadersResponseType);

        const newHeaders: Array<HeaderData> = [];
        const newIndices: Array<number> = [];
        for (let i = 0; i < res.indices.length; i++) {
            const h_i = res.indices[i];
            // TODO: could be more efficient (stop descending if a smaller index is found)
            // check if the index is new
            if(this.headerChunkIndices.lastIndexOf(h_i, h_i) < 0) {
                const h = res.headers[i];
                newHeaders.push(h);
                newIndices.push(h_i);
            }
        }
        this.headerChunkIndices.push(...newIndices);
        // put the new indices in their correct place.
        this.headerChunkIndices.sort();

        // add new headers to the graph

        cy.batch(() => {
            for (let h of newHeaders) {
                const nodeRoot = h.root.toString('hex');
                const parentRoot = h.header.parentRoot.toString('hex');
                const nodeID = `header_${nodeRoot}`;
                const node = cy.$id(nodeID);
                if (node.empty()) {
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: nodeID,
                            slot: h.header.slot
                        }
                    });
                } else {
                    // update placeholder
                    const placeholder = node[0];
                    placeholder.removeData('placeholder');
                    placeholder.data('slot', h.header.slot);
                }

                // if the parent does not exist, create a placeholder.
                const parentID = `header_${parentRoot}`;
                const parentNode = cy.$id(parentID);
                if(parentNode.empty()) {
                    cy.add({
                        group: 'nodes',
                        data: {
                            id: parentID,
                            placeholder: true,
                        }
                    });
                }

                // create edge if it does not exist yet.
                const edgeID = `header_conn_${parentRoot}_${nodeRoot}`;
                const edge = cy.$id(edgeID);
                if (edge.empty()) {
                    cy.add({
                        group: 'edges',
                        data: {
                            id: edgeID,
                            source: nodeRoot,
                            target: parentRoot
                        }
                    })
                }
            }
        });
    }
}

export const BlockHeadersContentType = {
    transform: (node: NodeSingular, pos: Point) => ({x: node.data('slot') * pixelsPerSlot, y: pos.y}),
    initContent: (chunkID: ChunkID, contentID: ContentID) => new BlockHeadersChunkContent(chunkID, contentID)
};
