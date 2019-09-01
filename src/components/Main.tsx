import React, {Component} from 'react';
// @ts-ignore
import CytoscapeComponent from 'react-cytoscapejs';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import cytoscape from "cytoscape";
import {Button, Paper, Typography} from "@material-ui/core";
import "./Main.css";
import {defaultLayoutOpts, LayoutOptions} from "./LayoutOptions";
import {Graph, LayoutOptionsData} from "../graph/Graph";
import {chunkWidth} from "../graph/Constants";

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
        selector: 'node[slot]',
        style: {
            'label': 'data(slot)',
            'color': '#fff',
            'shape': 'rectangle',
            'background-color': '#88b'
        }
    },
    {
        selector: 'node[chunk_box]',
        style: {
            'label': 'data(chunk_box)',
            'color': '#fff',
            'background-color': '#000',
            'shape': 'rectangle',
            'height': 1000,
            'width': 20,
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

export class Main extends Component<MainProps, MainState> {

    state: Readonly<MainState> = {
        loaded: false,
        wsOpen: false,
        layoutOpts: defaultLayoutOpts,
    };

    private cy: CY | undefined;

    private graph: Graph | undefined;

    onStatusWS(open: boolean) {
        this.setState({
            wsOpen: open,
        })
    };

    makeCyRef = (cy: CY) => {
        this.cy = cy;
        this.graph = new Graph(cy, this.onStatusWS);
        this.graph.setupCY();
        // TODO: reload data from WS on CY reset.
        console.log("reset CY instance");
    };

    layoutDag = () => {
        if(this.graph) {
            this.graph.layoutDag(this.state.layoutOpts);
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

    onLayoutOptions = (data: LayoutOptionsData) => {
        this.setState({layoutOpts: data}, this.layoutDag);
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
