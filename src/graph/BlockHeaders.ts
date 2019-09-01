import {ChunkID, chunkWidth, ContentID, CY, pixelsPerSecond, Point, WSSendFn} from "./Constants";
import {NodeSingular} from "cytoscape";

const secondsPerSlot = 6;

const pixelsPerSlot = secondsPerSlot * pixelsPerSecond;

const slotsPerChunk = chunkWidth / pixelsPerSlot;


function getRandomArbitrary(min: number, max: number) {
    return Math.round(Math.random() * (max - min) + min);
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
        const buf = new ArrayBuffer(1 + 1 + 4);
        const data = new DataView(buf);
        data.setUint8(0, 1);
        data.setUint8(1, this.contentID);
        data.setUint32(2, this.chunkID, true);
        // TODO: encode known header indices
        sendWS(data)
    }

    unload(ws: WSSendFn, cy: CY){
        console.log("unloading headers for chunk ", this.chunkID);
    }

    refresh(ws: WSSendFn){
        console.log("refreshing headers for chunk ", this.chunkID);
    }

    mock = (cy: CY) => {
        cy.batch(() => {
            const max = 100;
            const distance = 10;

            cy.elements().remove();

            cy.add({
                group: 'nodes',
                data: {
                    id: `node_0`,
                    slot: 0
                }
            });

            for (let i = 1; i < max; i++) {
                const prev = getRandomArbitrary(Math.max(0, i - distance), i-1);
                const prevNode = cy.$id(`node_${prev}`);
                const slot = prevNode.data('slot') + getRandomArbitrary(1, 5);
                cy.add({
                    group: 'nodes',
                    data: {
                        id: `node_${i}`,
                        slot: slot
                    }
                });
                cy.add({
                    group: 'edges',
                    data: {
                        id: `edge_${prev}_${i}`,
                        source: `node_${prev}`,
                        target: `node_${i}`,
                    }
                });
            }
        });
    };

    handleMsg(msg: DataView, cy: CY){
        // TODO read data with SSZ
        console.log("receiver msg: ", msg);

        // // TODO add nodes, connect with existing nodes
        // this.cy.batch(() => {
        //     const node = this.cy.$id(`node_${0}`);
        //     // TODO: check if node exists
        //     // add or update node
        //     const slot = 123;
        //     this.cy.add({
        //         group: 'nodes',
        //         data: {
        //             id: `node_0`,
        //             slot: 0
        //         },
        //         position: {x: slot * slotWidth, y: 200}
        //     });
        //     // TODO trigger layout with animation
        // });
    }
}

export const BlockHeadersContentType = {
    transform: (node: NodeSingular, pos: Point) => ({x: node.data('slot') * pixelsPerSlot, y: pos.y}),
    initContent: (chunkID: ChunkID, contentID: ContentID) => new BlockHeadersChunkContent(chunkID, contentID)
};
