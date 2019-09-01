import {ChunkID, chunkWidth, CY, pixelsPerSecond, Point, WSSendFn} from "./Constants";
import {NodeSingular} from "cytoscape";

const secondsPerSlot = 6;

const pixelsPerSlot = secondsPerSlot * pixelsPerSecond;

const slotsPerChunk = chunkWidth / pixelsPerSlot;


function getRandomArbitrary(min: number, max: number) {
    return Math.round(Math.random() * (max - min) + min);
}

export class BlockHeadersChunkContent {

    static id: number = 1;

    private id: ChunkID;

    private headerChunkIndices: Array<number>;

    constructor(id: ChunkID) {
        this.id = id;
        this.headerChunkIndices = new Array<number>();
    }

    load(ws: WSSendFn){
        console.log("loading headers for chunk ", this.id);
    }

    unload(ws: WSSendFn, cy: CY){
        console.log("unloading headers for chunk ", this.id);
    }

    refresh(ws: WSSendFn){
        console.log("refreshing headers for chunk ", this.id);
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

    handleMsg(buf: Buffer, cy: CY){
        // TODO read data with SSZ

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
    initContent: (id: ChunkID) => new BlockHeadersChunkContent(id)
};
