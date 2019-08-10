export class BlockHeadersGraphContent {
    // TODO

    processChunkData(msg: Buffer) {
        // TODO read data with SSZ

        // TODO add nodes, connect with existing nodes
        this.cy.batch(() => {
            const node = this.cy.$id(`node_${0}`);
            // TODO: check if node exists
            // add or update node
            const slot = 123;
            this.cy.add({
                group: 'nodes',
                data: {
                    id: `node_0`,
                    slot: 0
                },
                position: {x: slot * slotWidth, y: 200}
            });
            // TODO trigger layout with animation
        });
    }
}
