import React, {Component} from 'react';
// @ts-ignore
import CytoscapeComponent from 'react-cytoscapejs';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import cytoscape, {EdgeSingularTraversing} from "cytoscape";
import {Button, Paper, Typography} from "@material-ui/core";
import "./Main.css";
import ReconnectingWebSocket from "reconnecting-websocket";
import {defaultLayoutOpts, LayoutOptions, LayoutOptionsData} from "./LayoutOptions";

cytoscape.use(dagre);

const cytoStyles: Array<cytoscape.Stylesheet> = [
    {
        selector: 'edge',
        style: {
            'curve-style': 'straight',
            'target-arrow-shape': 'triangle',
            "line-color": "#77b",
            'target-arrow-color': '#aaf',
        }
    },
    {
        selector: 'node',
        style: {
            'label': 'data(slot)',
            'color': '#fff',
            'shape': 'rectangle',
            'background-color': '#88b'
        }
    }
];

type MainState = {
    loaded: boolean,
    wsOpen: boolean,
    layoutOpts: LayoutOptionsData
}

interface MainProps {

}

type CY = cytoscape.Core;

function getRandomArbitrary(min: number, max: number) {
    return Math.round(Math.random() * (max - min) + min);
}

export class Main extends Component<MainProps, MainState> {

    state: Readonly<MainState> = {
        loaded: false,
        wsOpen: false,
        layoutOpts: defaultLayoutOpts,
    };

    private cy: CY | undefined;

    onStatusWS = (open: boolean) => () => {
        this.setState({
            wsOpen: open,
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

    onLayoutOptions = (data: LayoutOptionsData) => {
        this.setState({layoutOpts: data}, this.layoutDag);
    };

    layoutDag = () => {
        if (this.cy) {
            const options = {
                animate: true,
                animationDuration: 2000,
                name: 'dagre',
                // @ts-ignore
                ranker: this.state.layoutOpts.ranker,
                nodeSep: this.state.layoutOpts.nodeSep,
                edgeSep: this.state.layoutOpts.edgeSep,
                rankSep: this.state.layoutOpts.rankSep,
                // @ts-ignore
                rankDir: 'LR', // TODO: maybe rotate on mobile layout?
            };

            if (!this.state.layoutOpts.compact) {
                // @ts-ignore
                options.minLen = ((edge: EdgeSingularTraversing ) => edge.target().data('slot') - edge.source().data('slot'));
            }
            const layout = this.cy.layout(options);
            layout.run();
        }
    };

    mock = () => {
        const cy = this.cy;
        if (cy) {
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

                this.layoutDag();
            });
        }
    };

    render() {
        return (
            <>
                <Paper className="overlay infoOverlay">
                    <Typography component="p">
                        Work in progress
                    </Typography>
                </Paper>
                <Paper className="overlay debugOverlay">
                    <Typography variant="h5" component="h3">
                        Debug Util
                    </Typography>
                    <Button variant="contained" onClick={this.mock}>Mock data</Button>
                </Paper>
                <Paper className="overlay layoutOverlay">
                    <LayoutOptions onOptions={this.onLayoutOptions}/>

                    <Button variant="contained" onClick={this.layoutDag}>Layout DAG</Button>
                </Paper>
                <CytoscapeComponent className="cytoRoot" elements={[]}
                                    stylesheet={cytoStyles}
                                    layout={{name: "preset"}}
                                    pan={{x: 0, y: 0}}
                                    cy={this.makeCyRef}/>
            </>
        )
    }
}
