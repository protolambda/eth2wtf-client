import React, {Component} from 'react';
// @ts-ignore
import CytoscapeComponent from 'react-cytoscapejs';
// @ts-ignore
import klay from 'cytoscape-klay';
import cytoscape from "cytoscape";
import {Paper, Typography} from "@material-ui/core";
import ReconnectingWebSocket from "reconnecting-websocket";

cytoscape.use(klay);

type MainState = {
    loaded: boolean,
    wsOpen: boolean
}

const cytoStyles: Array<cytoscape.Stylesheet> = [
    {
        selector: 'edge',
        style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle'
        }
    }
];

type CY = cytoscape.Core;

export class Main extends Component<{}, MainState> {

    private cy: CY | undefined;

    onStatusWS = (open: boolean) => () => {
        this.setState({
            wsOpen: open
        })
    };

    setupWS = () => {
        const rws = new ReconnectingWebSocket('ws://localhost:4000/ws', [], {debug: true});
        rws.binaryType = 'arraybuffer';
        rws.addEventListener('close', this.onStatusWS(false));
        rws.addEventListener('open', this.onStatusWS(true));
        rws.addEventListener('message', (msg) => {
            const buf = msg.data;
            // TODO
        });
        return () => {
            rws.close();
        };
    };

    makeCyRef = (cy: CY) => {
        this.cy = cy;
        // TODO: reload data from WS on CY reset.
        console.log("reset CY instance");
    };

    layout = () => {
        if (this.cy) {
            const layout = this.cy.layout({name: 'klay'});
            layout.run();
        }
    };

    render() {
        return (
            <>
                <Paper>
                    <Typography variant="h5" component="h3">
                        TODO graph component
                    </Typography>
                    <Typography component="p">
                        Work in progress
                    </Typography>
                </Paper>
                <CytoscapeComponent elements={[]}
                                    stylesheet={cytoStyles}
                                    layout={{name: "preset"}}
                                    pan={{x: 0, y: 0}}
                                    cy={this.makeCyRef}/>
            </>
        )
    }
}
