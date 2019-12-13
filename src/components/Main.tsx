import React, {Component} from 'react';
// @ts-ignore
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from "cytoscape";
import {Button, Paper, Typography} from "@material-ui/core";
import "./Main.css";
import {Graph} from "../graph/Graph";
import {CustomLayoutOptions, defaultCustomLayoutOpts} from "../graph/Constants";
import {LayoutOptions} from "./LayoutOptions";

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
        selector: 'node[slot]',
        style: {
            'label': 'data(slot)',
            'color': '#fff',
            'shape': 'rectangle',
            'background-color': '#88b'
        }
    },
    {
        selector: 'node[placeholder]',
        style: {
            'label': 'data(chunk_id)',
            'color': '#c00',
            'background-color': '#000',
            'shape': 'rectangle',
            'height': 10,
            'width': 10,
        }
    }
];

type MainState = {
    loaded: boolean,
    wsOpen: boolean,
}

interface MainProps {

}

type CY = cytoscape.Core;

export class Main extends Component<MainProps, MainState> {

    state: Readonly<MainState> = {
        loaded: false,
        wsOpen: false,
    };

    private cy: CY | undefined;

    private graph: Graph | undefined;

    onStatusWS = (open: boolean) => {
        this.setState({
            wsOpen: open,
        })
    };

    makeCyRef = (cy: CY) => {
        if (this.cy === cy) {
            console.log("already have CY");
            return;
        }
        if (this.graph) {
            // close old graph
            this.graph.close();
        }
        this.cy = cy;
        this.graph = new Graph(cy, this.onStatusWS);
        this.graph.setupCY();
        this.graph.setupWS();
        // TODO: reload data from WS on CY reset.
        console.log("reset CY instance");
    };

    layoutDag = () => {
        if(this.graph) {
            this.graph.layoutDag(0, this.graph.eventIndex);
        }
    };

    fitDag = () => {
        if(this.graph) {
            this.graph.fit();
        }
    };

    panDag = () => {
        if(this.graph) {
            this.graph.pan(0, 0);
        }
    };

    onLayoutOptions = (opts: CustomLayoutOptions) => {
        if (this.graph) {
            this.graph.setLayoutOptions(opts);
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
                    <Button variant="contained">Mock data</Button>
                </Paper>
                <Paper className="overlay layoutOverlay">
                    <LayoutOptions onOptions={this.onLayoutOptions}/>

                    <Button variant="contained" onClick={this.layoutDag}>Layout DAG</Button>
                    <Button variant="contained" onClick={this.fitDag}>Fit DAG</Button>
                    <Button variant="contained" onClick={this.panDag}>Pan DAG</Button>
                </Paper>
                <CytoscapeComponent className="cytoRoot" elements={[]}
                                    stylesheet={cytoStyles}
                                    minZoom={0.1}
                                    maxZoom={10}
                                    layout={{name: "preset"}}
                                    pan={{x: 0, y: 0}}
                                    cy={this.makeCyRef}/>
            </>
        )
    }
}
