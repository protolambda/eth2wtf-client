import {CY, EventIndex, Point, pixelsPerSecond} from "./Constants";
import {NodeSingular} from "cytoscape";
import {BeaconBlockHeader, Hash} from "@chainsafe/eth2.0-types";
import {types} from "@chainsafe/eth2.0-ssz-types/lib/presets/mainnet";
import {AnyContainerType, deserialize} from "@chainsafe/ssz";

const secondsPerSlot = 6;

const pixelsPerSlot = secondsPerSlot * pixelsPerSecond;


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

export const BlockHeadersContentType = {
    transform: (node: NodeSingular, pos: Point): Point => {
        const slot: number | undefined = node.data('slot');
        if (slot !== undefined) {
            return ({x: slot * pixelsPerSlot, y: pos.y}) // TODO: pos.y?
        } else {
            return pos;
        }
    },
    processEvent: (msg: DataView, eventIndex: EventIndex, cy: CY) => {
        console.log("received msg: ", msg, " ev index: ", eventIndex);

        const input = Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength);
        const h: HeaderData = deserialize(input, HeaderDataType);

        console.log("received header event (", eventIndex, "): ", h.header.slot, h.header.parentRoot.toString('hex'), h.root.toString('hex'));
        // add new headers to the graph
        const nodeRoot = h.root.toString('hex');
        const parentRoot = h.header.parentRoot.toString('hex');


        // if the parent does not exist, create a placeholder.
        const parentID = `header_${parentRoot}`;
        const parentNode = cy.$id(parentID);
        if(parentNode.empty()) {
            cy.add({
                group: 'nodes',
                data: {
                    id: parentID,
                    slot: h.header.slot - 1,
                    placeholder: true,
                    eventIndex: eventIndex,
                    content_type: BlockHeadersContentType,
                },
                position: {
                    x: 1000000,
                    y: 0,
                }
            });
        }

        const nodeID = `header_${nodeRoot}`;
        const node = cy.$id(nodeID);
        if (node.empty()) {
            const parentPos = cy.$id(parentID)[0].position();
            cy.add({
                group: 'nodes',
                data: {
                    id: nodeID,
                    slot: h.header.slot,
                    eventIndex: eventIndex,
                    content_type: BlockHeadersContentType,
                },
                position: {
                    x: parentPos.x + 10,
                    y: parentPos.y,
                }
            });
        } else {
            // update placeholder
            const placeholder = node[0];
            placeholder.removeData('placeholder');
            placeholder.data('slot', h.header.slot);
            console.log("double header msg", h);
            return
        }

        // create edge if it does not exist yet.
        const edgeID = `header_conn_${parentRoot}_${nodeRoot}`;
        const edge = cy.$id(edgeID);
        if (edge.empty()) {
            cy.add({
                group: 'edges',
                data: {
                    id: edgeID,
                    eventIndex: eventIndex,
                    target: parentID,
                    source: nodeID
                }
            })
        }
    }
};
